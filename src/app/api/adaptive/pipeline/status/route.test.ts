import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';

const { createAdaptiveCachedReadRouteMock } = vi.hoisted(() => ({
  createAdaptiveCachedReadRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
}));

vi.mock('@/app/api/adaptive/cached-read-route', () => ({
  createAdaptiveCachedReadRoute: createAdaptiveCachedReadRouteMock,
}));

describe('GET /api/adaptive/pipeline/status', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdaptiveCachedReadRouteMock.mockClear();
  });

  it('configures the non-infra pipeline status cache policy', async () => {
    const route = await import('@/app/api/adaptive/pipeline/status/route');

    expect(route.dynamic).toBe('force-dynamic');
    expect(createAdaptiveCachedReadRouteMock).toHaveBeenCalledTimes(1);
    expect(createAdaptiveCachedReadRouteMock).toHaveBeenCalledWith({
      targetPath: '/pipeline/status',
      revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.pipelineStatus,
      cacheTag: ADAPTIVE_CACHE_TAGS.pipelineStatus,
    });
    const options = createAdaptiveCachedReadRouteMock.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(options).toBeDefined();
    expect(options).not.toHaveProperty('infra');
    expect(route.GET).toBeTypeOf('function');
    expect(createAdaptiveCachedReadRouteMock.mock.results[0]?.value).toBe(route.GET);
  });
});
