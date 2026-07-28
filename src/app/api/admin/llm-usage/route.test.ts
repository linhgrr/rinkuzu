import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));

import { GET } from '@/app/api/admin/llm-usage/route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/llm-usage${query}`);
}

describe('GET /api/admin/llm-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession);
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('allowlists the usage window and forces private no-store', async () => {
    const response = await GET(request('?window=90d'), routeContext);

    expect(response.status).toBe(200);
    const [upstreamRequest, path, auth] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(new URL(upstreamRequest.url).searchParams.toString()).toBe('window=90d');
    expect(path).toBe('/admin/llm-usage/summary');
    expect(auth).toEqual({ userId: 'admin-1', userRole: 'admin' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('rejects unsupported or unexpected query parameters', async () => {
    expect((await GET(request('?window=365d'), routeContext)).status).toBe(400);
    expect((await GET(request('?window=30d&user_id=someone'), routeContext)).status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
