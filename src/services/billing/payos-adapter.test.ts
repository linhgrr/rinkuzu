import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingPayOSAdapter } from './payos-adapter';

/**
 * The adapter used to call `response.json()` before looking at the status, so an
 * empty 404 or an HTML gateway error surfaced as a JSON parse failure. That
 * mattered: `getPayment` returning null on 404 is load-bearing for duplicate
 * resolution and for the "provider has no record" reconciliation branch.
 */
describe('BillingPayOSAdapter response handling', () => {
  const adapter = new BillingPayOSAdapter();
  const fetchMock = vi.fn();

  function respond(status: number, body: string, contentType = 'application/json'): Response {
    return new Response(body, { status, headers: { 'content-type': contentType } });
  }

  beforeEach(() => {
    vi.stubEnv('PAYOS_CLIENT_ID', 'client');
    vi.stubEnv('PAYOS_API_KEY', 'key');
    vi.stubEnv('PAYOS_CHECKSUM_KEY', 'checksum');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('getPayment', () => {
    it('reports no payment for a 404 with an empty body', async () => {
      fetchMock.mockResolvedValue(respond(404, ''));
      await expect(adapter.getPayment(1234)).resolves.toBeNull();
    });

    it('reports no payment for a 404 that carries an HTML error page', async () => {
      fetchMock.mockResolvedValue(respond(404, '<html>Not Found</html>', 'text/html'));
      await expect(adapter.getPayment(1234)).resolves.toBeNull();
    });

    it('raises a status-bearing error for an unreadable gateway failure', async () => {
      fetchMock.mockResolvedValue(respond(502, '<html>Bad Gateway</html>', 'text/html'));
      await expect(adapter.getPayment(1234)).rejects.toThrow('PayOS responded with HTTP 502');
    });

    it('returns the snapshot for a well-formed success', async () => {
      fetchMock.mockResolvedValue(
        respond(
          200,
          JSON.stringify({
            code: '00',
            desc: 'success',
            data: {
              id: 'link-1',
              orderCode: 1234,
              amount: 100_000,
              amountPaid: 100_000,
              amountRemaining: 0,
              currency: 'VND',
              status: 'PAID',
              createdAt: '2026-08-27T00:00:00.000Z',
              transactions: [],
            },
          }),
        ),
      );

      const snapshot = await adapter.getPayment(1234);
      expect(snapshot?.id).toBe('link-1');
      expect(snapshot?.amountPaid).toBe(100_000);
    });
  });

  describe('createCheckout', () => {
    const input = {
      orderCode: 1234,
      amount: 100_000,
      description: 'Premium',
      returnUrl: 'https://www.rinkuzu.app/checkout?order=x',
      cancelUrl: 'https://www.rinkuzu.app/checkout?order=x',
      expiredAt: 1_800_000_000,
      buyerEmail: 'buyer@example.test',
    };

    it('treats an unreadable 200 as indeterminate rather than created', async () => {
      // Never claim a link exists off a response we could not read.
      fetchMock.mockResolvedValue(respond(200, '<html>oops</html>', 'text/html'));
      await expect(adapter.createCheckout(input)).resolves.toMatchObject({
        kind: 'indeterminate',
      });
    });

    it('keeps a 400 a definite failure and still reports a reason', async () => {
      fetchMock.mockResolvedValue(respond(400, ''));
      await expect(adapter.createCheckout(input)).resolves.toEqual({
        kind: 'definite_failure',
        message: 'PayOS responded with HTTP 400',
      });
    });

    it('treats a 5xx as indeterminate', async () => {
      fetchMock.mockResolvedValue(respond(503, ''));
      await expect(adapter.createCheckout(input)).resolves.toMatchObject({
        kind: 'indeterminate',
      });
    });
  });
});
