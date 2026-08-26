import { describe, expect, it, vi } from 'vitest';
import {
  invokeCommunicationWorker,
  type SchedulerEnvironment,
} from '../../infra/cloudflare/communications-scheduler/src/index';

const VALID_ENVIRONMENT: SchedulerEnvironment = {
  CRON_SECRET: 'a-production-cron-secret-that-is-long-enough',
  TARGET_URL: 'https://rinkuzu.app/api/internal/communications/worker',
};

describe('Cloudflare communications scheduler', () => {
  it('calls the production worker with signed POST semantics', async () => {
    let capturedTarget: string | URL | Request | undefined;
    let capturedRequest: RequestInit | undefined;
    const fetcher = vi.fn(async (target: string | URL | Request, request?: RequestInit) => {
      capturedTarget = target;
      capturedRequest = request;
      return new Response(null, { status: 200 });
    });

    await invokeCommunicationWorker(VALID_ENVIRONMENT, 1_777_777_777_000, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(capturedTarget?.toString()).toBe(VALID_ENVIRONMENT.TARGET_URL);
    expect(capturedRequest).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(new Headers(capturedRequest?.headers).get('authorization')).toBe(
      `Bearer ${VALID_ENVIRONMENT.CRON_SECRET}`,
    );
    expect(new Headers(capturedRequest?.headers).get('x-request-id')).toBe(
      'cloudflare-cron-1777777777000',
    );
  });

  it('rejects a missing or short secret before making a request', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(
      invokeCommunicationWorker({ ...VALID_ENVIRONMENT, CRON_SECRET: 'short' }, 1, fetcher),
    ).rejects.toThrow('CRON_SECRET is missing or invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'http://rinkuzu.app/api/internal/communications/worker',
    'https://example.com/api/internal/communications/worker',
    'https://rinkuzu.app/api/internal/communications/worker?redirect=1',
    'https://rinkuzu.app/api/internal/communications/other',
  ])('rejects an unexpected target: %s', async (target) => {
    await expect(
      invokeCommunicationWorker({ ...VALID_ENVIRONMENT, TARGET_URL: target }, 1),
    ).rejects.toThrow('TARGET_URL must be the Rinkuzu production communications worker');
  });

  it('fails the invocation when the application worker is unhealthy', async () => {
    await expect(
      invokeCommunicationWorker(
        VALID_ENVIRONMENT,
        1,
        vi.fn(async () => new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow('Communications worker returned HTTP 503');
  });
});
