import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { GET } from '@/app/api/admin/personal-learning/summary/route';

const routeContext = { params: Promise.resolve({}) };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/personal-learning/summary${query}`);
}

describe('GET /api/admin/personal-learning/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('forwards the allowlisted window and forces private no-store', async () => {
    const response = await GET(request('?window=90d'), routeContext);

    expect(response.status).toBe(200);
    const [upstreamRequest, path, auth] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(new URL(upstreamRequest.url).searchParams.toString()).toBe('window=90d');
    expect(path).toBe('/admin/personal-learning/summary');
    expect(auth).toEqual({ userId: 'admin-1', userRole: 'admin' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('defaults to the 30-day window', async () => {
    await GET(request(), routeContext);

    const [upstreamRequest] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(new URL(upstreamRequest.url).searchParams.get('window')).toBe('30d');
  });

  it('rejects unsupported windows and unexpected parameters', async () => {
    expect((await GET(request('?window=365d'), routeContext)).status).toBe(400);
    expect((await GET(request('?window=30d&user_id=someone'), routeContext)).status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('refuses non-admin sessions', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    expect((await GET(request('?window=7d'), routeContext)).status).toBe(403);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
