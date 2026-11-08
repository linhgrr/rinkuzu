import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyAdaptiveRequestMock } = vi.hoisted(() => ({ proxyAdaptiveRequestMock: vi.fn() }));

vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { proxyAdminAdaptiveRead } from '@/lib/adaptive/admin-read-proxy';

describe('proxyAdminAdaptiveRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('forwards only the validated params and forces private no-store', async () => {
    const response = await proxyAdminAdaptiveRead(
      new Request('http://localhost/api/admin/x?window=7d&evil=1'),
      { window: '30d', skipped: undefined },
      '/admin/x/summary',
      { userId: 'admin-1', userRole: 'admin' },
    );

    const [upstreamRequest, path, auth] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(new URL(upstreamRequest.url).search).toBe('?window=30d');
    expect(upstreamRequest.method).toBe('GET');
    expect(path).toBe('/admin/x/summary');
    expect(auth).toEqual({ userId: 'admin-1', userRole: 'admin' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('keeps upstream error statuses and still forbids caching them', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('{}', { status: 503 }));

    const response = await proxyAdminAdaptiveRead(
      new Request('http://localhost/api/admin/x'),
      {},
      '/admin/x/summary',
      { userId: 'admin-1', userRole: 'admin' },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
