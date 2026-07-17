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

import { dynamic, GET } from '@/app/api/adaptive/subjects/route';

const request = new NextRequest('http://localhost/api/adaptive/subjects');
const routeContext = { params: Promise.resolve({}) };

describe('GET /api/adaptive/subjects', () => {
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

    const response = await GET(request, routeContext);

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies the subjects list with authenticated user ownership context', async () => {
    authMock.mockResolvedValue({
      user: { id: 'owner-9', email: 'owner@example.com', role: 'admin' },
    });

    await GET(request, routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(request, '/history/subjects', {
      userId: 'owner-9',
      userRole: 'admin',
    });
  });
});
