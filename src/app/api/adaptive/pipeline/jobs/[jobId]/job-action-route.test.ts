import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, invalidateCacheMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  invalidateCacheMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/cache-policy', () => ({
  invalidateAdaptiveServiceCache: invalidateCacheMock,
}));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));

import { createAdaptiveJobActionRoute } from './job-action-route';

const request = new NextRequest('http://localhost/api/adaptive/pipeline/jobs/job-1/retry', {
  method: 'POST',
});

describe('createAdaptiveJobActionRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('forwards the configured action, timeout, and authenticated user context', async () => {
    const handler = createAdaptiveJobActionRoute({ action: 'retry', timeoutMs: 30_000 });

    const response = await handler(request, {
      params: Promise.resolve({ jobId: 'job-1' }),
    });

    expect(response.status).toBe(204);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/pipeline/jobs/job-1/retry',
      { userId: 'user-1', userRole: 'user' },
      { method: 'POST', timeoutMs: 30_000 },
    );
    expect(invalidateCacheMock).toHaveBeenCalledOnce();
  });

  it('rejects invalid params before proxying or invalidating cache', async () => {
    const handler = createAdaptiveJobActionRoute({ action: 'cancel', timeoutMs: 25_000 });

    const response = await handler(request, {
      params: Promise.resolve({ jobId: '' }),
    });

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });
});
