import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';

const { createAdaptiveCachedReadRouteMock } = vi.hoisted(() => ({
  createAdaptiveCachedReadRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
}));

vi.mock('@/app/api/adaptive/cached-read-route', () => ({
  createAdaptiveCachedReadRoute: createAdaptiveCachedReadRouteMock,
}));

describe('GET /api/adaptive/ready', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdaptiveCachedReadRouteMock.mockClear();
  });

  it('configures the infra health cache policy on the shared adaptive read route', async () => {
    const route = await import('@/app/api/adaptive/ready/route');

    expect(route.dynamic).toBe('force-dynamic');
    expect(createAdaptiveCachedReadRouteMock).toHaveBeenCalledTimes(1);
    expect(createAdaptiveCachedReadRouteMock).toHaveBeenCalledWith({
      targetPath: '/ready',
      infra: true,
      revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.health,
      cacheTag: ADAPTIVE_CACHE_TAGS.health,
    });
    expect(route.GET).toBeTypeOf('function');
    expect(createAdaptiveCachedReadRouteMock.mock.results[0]?.value).toBe(route.GET);
  });
});
