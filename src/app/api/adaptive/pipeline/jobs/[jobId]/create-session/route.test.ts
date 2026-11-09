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

import { dynamic, POST } from '@/app/api/adaptive/pipeline/jobs/[jobId]/create-session/route';

function request(jobId: string, query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/adaptive/pipeline/jobs/${jobId}/create-session${query}`,
    {
      method: 'POST',
    },
  );
}

function context(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

describe('POST /api/adaptive/pipeline/jobs/[jobId]/create-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('exports force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await POST(request('job-1'), context('job-1'));

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('rejects invalid jobId params before proxying or invalidating cache', async () => {
    const response = await POST(request(''), context(''));

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('rejects invalid max_steps before proxying', async () => {
    const response = await POST(request('job-1', '?max_steps=4'), context('job-1'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toBeDefined();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('proxies with default max_steps, generation llmAction, and invalidates cache', async () => {
    authMock.mockResolvedValue({
      user: { id: 'owner-4', email: 'owner@example.com', role: 'admin' },
    });

    const response = await POST(request('job-22'), context('job-22'));

    expect(response.status).toBe(204);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-22/create-session?max_steps=9999',
      { userId: 'owner-4', userRole: 'admin' },
      {
        method: 'POST',
        llmAction: 'adaptive_generation',
        timeoutMs: 30_000,
      },
    );
    expect(invalidateCacheMock).toHaveBeenCalledOnce();
  });

  it('forwards a validated custom max_steps value', async () => {
    await POST(request('job-22', '?max_steps=25'), context('job-22'));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-22/create-session?max_steps=25',
      { userId: 'user-1', userRole: 'user' },
      {
        method: 'POST',
        llmAction: 'adaptive_generation',
        timeoutMs: 30_000,
      },
    );
  });

  it('forwards a valid UI locale with max_steps', async () => {
    await POST(request('job-22', '?max_steps=50&locale=vi'), context('job-22'));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-22/create-session?max_steps=50&locale=vi',
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects an unsupported locale before proxying', async () => {
    const response = await POST(request('job-22', '?locale=fr'), context('job-22'));

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });
});
