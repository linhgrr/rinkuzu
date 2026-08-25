import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { createAdaptiveCachedReadRoute } from '@/app/api/adaptive/cached-read-route';

const request = new NextRequest('http://localhost/api/adaptive/ready');
const routeContext = { params: Promise.resolve({}) };

describe('createAdaptiveCachedReadRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('ok'));
  });

  it('forwards the authenticated health cache policy and infra target', async () => {
    const route = createAdaptiveCachedReadRoute({
      targetPath: '/ready',
      infra: true,
      revalidateSeconds: 15,
      cacheTag: 'adaptive-health',
    });

    await route(request, routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/ready',
      {
        userId: 'user-1',
        userRole: 'user',
      },
      {
        infra: true,
        cache: { revalidateSeconds: 15, tags: ['adaptive-health'] },
      },
    );
  });

  it('keeps versioned status reads on the normal adaptive target', async () => {
    const route = createAdaptiveCachedReadRoute({
      targetPath: '/pipeline/status',
      revalidateSeconds: 30,
      cacheTag: 'adaptive-pipeline-status',
    });

    await route(request, routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/pipeline/status',
      {
        userId: 'user-1',
        userRole: 'user',
      },
      {
        cache: { revalidateSeconds: 30, tags: ['adaptive-pipeline-status'] },
      },
    );
  });
});
