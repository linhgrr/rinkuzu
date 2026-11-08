import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, invalidateCacheMock, proxyAdaptiveRequestMock, reconcileMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    invalidateCacheMock: vi.fn(),
    proxyAdaptiveRequestMock: vi.fn(),
    reconcileMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/cache-policy', () => ({
  invalidateAdaptiveServiceCache: invalidateCacheMock,
}));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));
vi.mock('@/lib/adaptive/pipeline-usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/adaptive/pipeline-usage')>()),
  reconcilePipelineUsage: reconcileMock,
}));

import { createAdaptiveJobActionRoute } from './job-action-route';
import { pipelineJobLinkFromEnvelope } from '@/lib/adaptive/pipeline-usage';

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
      {
        method: 'POST',
        timeoutMs: 30_000,
        llmAction: 'adaptive_pipeline',
        llmJobLink: pipelineJobLinkFromEnvelope,
      },
    );
    expect(invalidateCacheMock).toHaveBeenCalledOnce();
  });

  it('settles earlier attempts before the metered retry checks quota', async () => {
    const handler = createAdaptiveJobActionRoute({ action: 'retry', timeoutMs: 30_000 });

    await handler(request, { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(reconcileMock).toHaveBeenCalledWith({ userId: 'user-1', userRole: 'user' });
    expect(reconcileMock.mock.invocationCallOrder[0]).toBeLessThan(
      proxyAdaptiveRequestMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not meter cancel', async () => {
    const handler = createAdaptiveJobActionRoute({ action: 'cancel', timeoutMs: 25_000 });

    await handler(request, { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/pipeline/jobs/job-1/cancel',
      { userId: 'user-1', userRole: 'user' },
      { method: 'POST', timeoutMs: 25_000 },
    );
    expect(reconcileMock).not.toHaveBeenCalled();
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
