import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: class NextResponse extends Response {},
}));
vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveInfraUrl: (path: string) => `https://adaptive.test/api/${path}`,
  buildAdaptiveServiceHeaders: () => ({}),
  buildAdaptiveUrl: (path: string) => `https://adaptive.test/api/v1/${path}`,
  resolveAdaptiveProxyTimeoutMs: () => 30_000,
}));
vi.mock('@/lib/adaptive/cache-policy', () => ({
  isCacheSafeAdaptivePath: () => true,
}));

import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';

describe('proxyAdaptiveRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  it('omits absent body and Next cache options for uncached GET requests', async () => {
    const response = await proxyAdaptiveRequest(
      new Request('https://app.test/api/adaptive/health'),
      'health',
      {},
    );

    expect(response.status).toBe(204);
    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).not.toHaveProperty('body');
    expect(request).not.toHaveProperty('next');
    expect(request).toMatchObject({ method: 'GET', cache: 'no-store' });
  });

  it('adds validated Next cache options for safe cacheable GET requests', async () => {
    await proxyAdaptiveRequest(
      new Request('https://app.test/api/adaptive/subjects'),
      'subjects',
      {},
      { cache: { revalidateSeconds: 30, tags: ['adaptive-subjects'] } },
    );

    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).toMatchObject({
      cache: 'force-cache',
      next: { revalidate: 30, tags: ['adaptive-subjects'] },
    });
  });
});
