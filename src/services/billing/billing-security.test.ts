import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeBillingWorker } from '../../../infra/cloudflare/billing-scheduler/src/index';
import { assertInternalBillingRequest } from './billing-security';

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
