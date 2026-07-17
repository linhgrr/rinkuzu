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

import { dynamic, GET } from '@/app/api/adaptive/pipeline/jobs/route';

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/adaptive/pipeline/jobs${query}`);
}

const routeContext = { params: Promise.resolve({}) };

describe('GET /api/adaptive/pipeline/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('ok'));
  });

  it('exports force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies with the default limit, timeout, and authenticated ownership context', async () => {
    authMock.mockResolvedValue({
      user: { id: 'owner-2', email: 'owner@example.com', role: 'admin' },
    });

    await GET(request(), routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs?limit=50',
      { userId: 'owner-2', userRole: 'admin' },
      { timeoutMs: 25_000 },
    );
  });

  it('forwards a validated custom limit', async () => {
    await GET(request('?limit=7'), routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs?limit=7',
      { userId: 'user-1', userRole: 'user' },
      { timeoutMs: 25_000 },
    );
  });

  it('rejects invalid limits before proxying', async () => {
    const response = await GET(request('?limit=101'), routeContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toBeDefined();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
