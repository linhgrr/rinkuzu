import { describe, expect, it, vi } from 'vitest';
import {
  invokeBillingWorker,
  type SchedulerEnvironment,
} from '../../infra/cloudflare/billing-scheduler/src/index';

const VALID_ENVIRONMENT: SchedulerEnvironment = {
  BILLING_INTERNAL_HMAC_SECRET: 'a-production-billing-hmac-secret-long-enough',
  TARGET_ORIGIN: 'https://www.rinkuzu.app',
};

const PROCESS_URL = 'https://www.rinkuzu.app/api/internal/billing/process';
const RECONCILE_URL = 'https://www.rinkuzu.app/api/internal/billing/reconcile';

function okFetcher() {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher = vi.fn(async (target: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: target.toString(), init });
    return new Response(null, { status: 200 });
  });
  return { calls, fetcher };
}

describe('Cloudflare billing scheduler', () => {
  it('drains the inbox before reconciling, both as signed POSTs', async () => {
    const { calls, fetcher } = okFetcher();

    await invokeBillingWorker(VALID_ENVIRONMENT, 1_777_777_777_000, fetcher);

    expect(calls.map((call) => call.url)).toEqual([PROCESS_URL, RECONCILE_URL]);
    for (const call of calls) {
      expect(call.init).toMatchObject({ method: 'POST', redirect: 'manual' });
      const headers = new Headers(call.init?.headers);
      // The application requires exactly 13 digits and a 64-char hex HMAC.
      expect(headers.get('x-rinkuzu-timestamp')).toMatch(/^\d{13}$/);
      expect(headers.get('x-rinkuzu-signature')).toMatch(/^[a-f\d]{64}$/);
      expect(headers.get('x-rinkuzu-nonce')).toBeTruthy();
      expect(headers.get('x-request-id')).toBe('cloudflare-billing-cron-1777777777000');
    }
  });

  it('signs each path separately so a nonce is never replayed', async () => {
    const { calls, fetcher } = okFetcher();

    await invokeBillingWorker(VALID_ENVIRONMENT, 1, fetcher);

    const [first, second] = calls.map((call) => new Headers(call.init?.headers));
    expect(first?.get('x-rinkuzu-nonce')).not.toBe(second?.get('x-rinkuzu-nonce'));
    expect(first?.get('x-rinkuzu-signature')).not.toBe(second?.get('x-rinkuzu-signature'));
  });

  it('reconciles even when the inbox drain fails, then reports the failure', async () => {
    const fetcher = vi.fn(async (target: string | URL | Request) =>
      target.toString() === PROCESS_URL
        ? new Response(null, { status: 500 })
        : new Response(null, { status: 200 }),
    );

    await expect(invokeBillingWorker(VALID_ENVIRONMENT, 1, fetcher)).rejects.toThrow(
      'Billing worker /api/internal/billing/process returned HTTP 500',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]?.toString()).toBe(RECONCILE_URL);
  });

  it('rejects a missing or short secret before making a request', async () => {
    const { fetcher } = okFetcher();

    await expect(
      invokeBillingWorker(
        { ...VALID_ENVIRONMENT, BILLING_INTERNAL_HMAC_SECRET: 'short' },
        1,
        fetcher,
      ),
    ).rejects.toThrow('BILLING_INTERNAL_HMAC_SECRET is missing or invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'http://www.rinkuzu.app',
    'https://rinkuzu.app',
    'https://example.com',
    'https://www.rinkuzu.app/api/internal/billing/process',
    'https://www.rinkuzu.app/?redirect=1',
  ])('rejects an unexpected origin: %s', async (origin) => {
    const { fetcher } = okFetcher();

    await expect(
      invokeBillingWorker({ ...VALID_ENVIRONMENT, TARGET_ORIGIN: origin }, 1, fetcher),
    ).rejects.toThrow('TARGET_ORIGIN must be the Rinkuzu production origin');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects redirects instead of following them', async () => {
    await expect(
      invokeBillingWorker(
        VALID_ENVIRONMENT,
        1,
        vi.fn(async () => new Response(null, { status: 307 })),
      ),
    ).rejects.toThrow('returned HTTP 307');
  });
});
