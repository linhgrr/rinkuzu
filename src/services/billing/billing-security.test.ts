import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeBillingWorker } from '../../../infra/cloudflare/billing-scheduler/src/index';
import {
  assertInternalBillingRequest,
  hashRequestSourceIp,
  webhookAbuseBucket,
} from './billing-security';

const SECRET = 'a-production-billing-hmac-secret-long-enough';

/**
 * The scheduler lives in a separate deployment unit, so nothing at build time
 * couples its signing string to the verifier's. This suite is that coupling:
 * a drift in either canonical string turns every cron tick into a silent 401.
 */
describe('internal billing request authentication', () => {
  beforeEach(() => {
    vi.stubEnv('BILLING_INTERNAL_HMAC_SECRET', SECRET);
    vi.stubEnv('BILLING_INTERNAL_ALLOWED_IPS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function requestsSignedByScheduler(): Promise<NextRequest[]> {
    const requests: NextRequest[] = [];
    await invokeBillingWorker(
      { BILLING_INTERNAL_HMAC_SECRET: SECRET, TARGET_ORIGIN: 'https://www.rinkuzu.app' },
      1_777_777_777_000,
      async (target, init) => {
        // Rebuild without the abort signal: only method, path and headers
        // participate in the signature the verifier recomputes.
        requests.push(
          new NextRequest(target.toString(), {
            method: 'POST',
            headers: new Headers(init?.headers),
          }),
        );
        return new Response(null, { status: 200 });
      },
    );
    return requests;
  }

  it('accepts every request the Cloudflare scheduler signs', async () => {
    const requests = await requestsSignedByScheduler();
    expect(requests).toHaveLength(2);

    for (const request of requests) {
      const consumed: string[] = [];
      await expect(
        assertInternalBillingRequest(request, async (nonce) => {
          consumed.push(nonce);
        }),
      ).resolves.toBeUndefined();
      expect(consumed).toHaveLength(1);
    }
  });

  it('rejects a replayed nonce', async () => {
    const [request] = await requestsSignedByScheduler();
    if (!request) throw new Error('scheduler produced no request');

    await expect(
      assertInternalBillingRequest(request, async () => {
        throw new Error('nonce already consumed');
      }),
    ).rejects.toThrow('nonce already consumed');
  });

  it('rejects a signature minted for a different path', async () => {
    const [processRequest, reconcileRequest] = await requestsSignedByScheduler();
    if (!processRequest || !reconcileRequest) throw new Error('scheduler produced no request');

    const swapped = new NextRequest(reconcileRequest.url, {
      method: 'POST',
      headers: processRequest.headers,
    });

    await expect(assertInternalBillingRequest(swapped, async () => undefined)).rejects.toThrow(
      'Internal request signature is invalid',
    );
  });

  it('rejects a stale timestamp', async () => {
    const [request] = await requestsSignedByScheduler();
    if (!request) throw new Error('scheduler produced no request');

    const headers = new Headers(request.headers);
    headers.set('x-rinkuzu-timestamp', String(Date.now() - 6 * 60_000));
    const stale = new NextRequest(request.url, { method: 'POST', headers });

    await expect(assertInternalBillingRequest(stale, async () => undefined)).rejects.toThrow(
      'Internal request timestamp expired',
    );
  });

  it('refuses to run when the shared secret is not configured', async () => {
    const [request] = await requestsSignedByScheduler();
    if (!request) throw new Error('scheduler produced no request');
    vi.stubEnv('BILLING_INTERNAL_HMAC_SECRET', '');

    await expect(assertInternalBillingRequest(request, async () => undefined)).rejects.toThrow(
      'Internal billing authentication is not configured',
    );
  });
});

/**
 * The webhook endpoint is open to the internet, so the only ceiling on how much
 * work an anonymous caller can make it do is the per-source budget. Both halves
 * of that budget used to be able to disappear silently: no secret meant no
 * keyed hash, and no proxy header meant no bucket, and the caller read either
 * as "skip the rate limit".
 */
describe('the webhook abuse bucket', () => {
  const ABUSE_SECRET = 'an-abuse-signal-secret-of-at-least-32-chars';

  function webhookRequest(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://rinkuzu.test/api/billing/webhooks/payos', {
      method: 'POST',
      headers,
    });
  }

  beforeEach(() => {
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', ABUSE_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('always produces a bucket, whatever the platform reported', () => {
    // A delivery whose source is unknown still costs the endpoint a hash, a
    // classification and a durable row, so it is charged rather than waved
    // through. Returning nothing here is what removed the ceiling entirely.
    const headerSets: Record<string, string>[] = [
      {},
      { 'x-real-ip': '203.0.113.5' },
      { 'cf-connecting-ip': '203.0.113.6' },
      { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
    ];
    for (const headers of headerSets) {
      expect(webhookAbuseBucket(webhookRequest(headers))).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('gives two different sources two different buckets', () => {
    const left = webhookAbuseBucket(webhookRequest({ 'x-real-ip': '203.0.113.5' }));
    const right = webhookAbuseBucket(webhookRequest({ 'x-real-ip': '203.0.113.9' }));
    expect(left).not.toBe(right);
  });

  it('charges every unattributed delivery to one shared bucket', () => {
    // Not a free pass each: one caller stripping the header must not be able to
    // mint an unlimited number of empty buckets.
    expect(webhookAbuseBucket(webhookRequest())).toBe(webhookAbuseBucket(webhookRequest()));
  });

  it('reads only the first hop of a forwarded chain', () => {
    // Everything after the first hop is caller-controlled text.
    const single = webhookAbuseBucket(webhookRequest({ 'x-forwarded-for': '203.0.113.7' }));
    const chained = webhookAbuseBucket(
      webhookRequest({ 'x-forwarded-for': '203.0.113.7, 198.51.100.1, 10.0.0.1' }),
    );
    expect(chained).toBe(single);
  });

  it('refuses to accept webhook traffic in production with no secret', () => {
    // Falling back to a fixed stand-in in production would key every
    // deployment's buckets identically and make the payer signal forgeable.
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => webhookAbuseBucket(webhookRequest({ 'x-real-ip': '203.0.113.5' }))).toThrow(
      expect.objectContaining({ code: 'billing_configuration_error', status: 500 }),
    );
  });

  it('keeps a local run working on a fixed stand-in secret', () => {
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');

    expect(webhookAbuseBucket(webhookRequest({ 'x-real-ip': '203.0.113.5' }))).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

describe('the stored source hash', () => {
  function webhookRequest(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://rinkuzu.test/api/billing/webhooks/payos', {
      method: 'POST',
      headers,
    });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is null rather than an unkeyed digest when no secret is configured', () => {
    // This one is written to a row and kept. An unkeyed hash of an IPv4
    // address is reversible by exhausting four billion candidates, so there is
    // no honest fallback: absent is the correct answer.
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', '');
    expect(hashRequestSourceIp(webhookRequest({ 'x-real-ip': '203.0.113.5' }))).toBeNull();
  });

  it('is null when the platform reported no address at all', () => {
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', 'an-abuse-signal-secret-of-at-least-32-chars');
    expect(hashRequestSourceIp(webhookRequest())).toBeNull();
  });

  it('is a keyed digest when both are present', () => {
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', 'an-abuse-signal-secret-of-at-least-32-chars');
    expect(hashRequestSourceIp(webhookRequest({ 'x-real-ip': '203.0.113.5' }))).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
