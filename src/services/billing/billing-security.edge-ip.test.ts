import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeBillingWorker } from '../../../infra/cloudflare/billing-scheduler/src/index';
import {
  assertInternalBillingRequest,
  hashRequestSourceIp,
  webhookAbuseBucket,
} from './billing-security';

beforeEach(() => {
  vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');
});

const HMAC_SECRET = 'a-production-billing-hmac-secret-long-enough';
const EDGE_CLIENT_IP_HEADER = 'x-rinkuzu-client-ip';
const EDGE_SECRET_HEADER = 'x-rinkuzu-edge';
const EDGE_SECRET = 'edge-shared-secret-fixture-0123456789abcdef';
const FORGED_SECRET = 'forged-secret-forged-secret-forged-secret';
const ALLOWED = '198.51.100.7';
const CLOUDFLARE = '172.64.0.1';

async function signedRequest(extraHeaders: Record<string, string>): Promise<NextRequest> {
  const requests: NextRequest[] = [];
  await invokeBillingWorker(
    { BILLING_INTERNAL_HMAC_SECRET: HMAC_SECRET, TARGET_ORIGIN: 'https://www.rinkuzu.app' },
    1_777_777_777_000,
    async (target, init) => {
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
      requests.push(new NextRequest(target.toString(), { method: 'POST', headers }));
      return new Response(null, { status: 200 });
    },
  );
  const [first] = requests;
  if (!first) throw new Error('scheduler produced no request');
  return first;
}

describe('internal billing source allowlist behind the edge Worker', () => {
  beforeEach(() => {
    vi.stubEnv('BILLING_INTERNAL_HMAC_SECRET', HMAC_SECRET);
    vi.stubEnv('BILLING_INTERNAL_ALLOWED_IPS', ALLOWED);
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts an allowed source reported through the authenticated edge header', async () => {
    const request = await signedRequest({
      'x-real-ip': CLOUDFLARE,
      [EDGE_CLIENT_IP_HEADER]: ALLOWED,
      [EDGE_SECRET_HEADER]: EDGE_SECRET,
    });

    await expect(
      assertInternalBillingRequest(request, async () => undefined),
    ).resolves.toBeUndefined();
  });

  it('rejects an allowed source in the edge header when the edge secret is forged', async () => {
    const request = await signedRequest({
      'x-real-ip': CLOUDFLARE,
      [EDGE_CLIENT_IP_HEADER]: ALLOWED,
      [EDGE_SECRET_HEADER]: FORGED_SECRET,
    });

    await expect(assertInternalBillingRequest(request, async () => undefined)).rejects.toThrow(
      'Internal request source is not allowed',
    );
  });

  it('rejects the edge header when no edge secret is configured', async () => {
    vi.stubEnv('EDGE_SHARED_SECRET', '');
    const request = await signedRequest({
      'x-real-ip': CLOUDFLARE,
      [EDGE_CLIENT_IP_HEADER]: ALLOWED,
      [EDGE_SECRET_HEADER]: EDGE_SECRET,
    });

    await expect(assertInternalBillingRequest(request, async () => undefined)).rejects.toThrow(
      'Internal request source is not allowed',
    );
  });

  it('still accepts an allowed platform x-real-ip without the edge headers', async () => {
    const request = await signedRequest({ 'x-real-ip': ALLOWED });

    await expect(
      assertInternalBillingRequest(request, async () => undefined),
    ).resolves.toBeUndefined();
  });
});

describe('webhook source hashing behind the edge Worker', () => {
  beforeEach(() => {
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', 'an-abuse-signal-secret-of-at-least-32-chars');
    vi.stubEnv('EDGE_SHARED_SECRET', EDGE_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function webhookRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest('https://rinkuzu.test/api/billing/webhooks/payos', {
      method: 'POST',
      headers,
    });
  }

  function viaEdge(visitor: string, secret: string): NextRequest {
    return webhookRequest({
      'x-real-ip': CLOUDFLARE,
      [EDGE_CLIENT_IP_HEADER]: visitor,
      [EDGE_SECRET_HEADER]: secret,
    });
  }

  it('buckets and hashes by the visitor, not the shared Cloudflare edge address', () => {
    const direct = webhookRequest({ 'x-real-ip': '203.0.113.5' });

    expect(webhookAbuseBucket(viaEdge('203.0.113.5', EDGE_SECRET))).toBe(
      webhookAbuseBucket(direct),
    );
    expect(hashRequestSourceIp(viaEdge('203.0.113.5', EDGE_SECRET))).toBe(
      hashRequestSourceIp(direct),
    );
  });

  it('ignores the edge header when the secret is forged', () => {
    expect(webhookAbuseBucket(viaEdge('203.0.113.5', FORGED_SECRET))).toBe(
      webhookAbuseBucket(webhookRequest({ 'x-real-ip': CLOUDFLARE })),
    );
  });
});
