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

import { dynamic, POST } from '@/app/api/adaptive/pipeline/jobs/[jobId]/cancel/route';

const request = new NextRequest('http://localhost/api/adaptive/pipeline/jobs/job-1/cancel', {
  method: 'POST',
});

describe('POST /api/adaptive/pipeline/jobs/[jobId]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('wires cancel action with the 25s timeout and invalidates cache', async () => {
    expect(dynamic).toBe('force-dynamic');

    const response = await POST(request, { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(response.status).toBe(204);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/pipeline/jobs/job-1/cancel',
      { userId: 'user-1', userRole: 'user' },
      { method: 'POST', timeoutMs: 25_000 },
    );
    expect(invalidateCacheMock).toHaveBeenCalledOnce();
  });

  it('requires authentication before proxying cancel', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request, { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('rejects invalid jobId without proxying or invalidating cache', async () => {
    const response = await POST(request, { params: Promise.resolve({ jobId: '' }) });

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });
});
