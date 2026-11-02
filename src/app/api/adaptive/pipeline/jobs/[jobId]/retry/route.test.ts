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

import { dynamic, POST } from '@/app/api/adaptive/pipeline/jobs/[jobId]/retry/route';
import { pipelineJobLinkFromEnvelope } from '@/lib/adaptive/pipeline-usage';

const request = new NextRequest('http://localhost/api/adaptive/pipeline/jobs/job-1/retry', {
  method: 'POST',
});

describe('POST /api/adaptive/pipeline/jobs/[jobId]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('wires a metered, job-linked retry with the 30s timeout and invalidates cache', async () => {
    expect(dynamic).toBe('force-dynamic');

    const response = await POST(request, { params: Promise.resolve({ jobId: 'job-1' }) });

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

  it('requires authentication before proxying retry', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request, { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('rejects invalid jobId without proxying or invalidating cache', async () => {
    const response = await POST(request, { params: Promise.resolve({ jobId: '..' }) });

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });
});
