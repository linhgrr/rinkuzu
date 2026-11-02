import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock, settleUsageMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
  settleUsageMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));
vi.mock('@/lib/adaptive/pipeline-usage', () => ({
  settlePipelineUsageFromResponse: settleUsageMock,
}));

import { dynamic, GET } from '@/app/api/adaptive/pipeline/jobs/[jobId]/route';

function request(jobId: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/adaptive/pipeline/jobs/${jobId}${query}`);
}

function context(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

describe('GET /api/adaptive/pipeline/jobs/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('ok'));
  });

  it('settles adaptive_pipeline usage from the job status it returns', async () => {
    const upstream = Response.json({ success: true, data: { jobs: [] } });
    proxyAdaptiveRequestMock.mockResolvedValue(upstream);

    const response = await GET(request('job-1'), context('job-1'));

    expect(response).toBe(upstream);
    expect(settleUsageMock).toHaveBeenCalledWith(upstream, { userId: 'user-1', userRole: 'user' });
  });

  it('exports force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await GET(request('job-1'), context('job-1'));

    expect(response.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(settleUsageMock).not.toHaveBeenCalled();
  });

  it('rejects invalid jobId params before proxying', async () => {
    const response = await GET(request(''), context(''));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid include_debug query values', async () => {
    const response = await GET(request('job-1', '?include_debug=yes'), context('job-1'));

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies without a debug query when include_debug is omitted', async () => {
    await GET(request('job-9'), context('job-9'));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-9',
      { userId: 'user-1', userRole: 'user' },
      { timeoutMs: 25_000 },
    );
  });

  it('omits the debug query when include_debug=false', async () => {
    await GET(request('job-9', '?include_debug=false'), context('job-9'));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-9',
      { userId: 'user-1', userRole: 'user' },
      { timeoutMs: 25_000 },
    );
  });

  it('appends include_debug=true and forwards authenticated ownership context', async () => {
    authMock.mockResolvedValue({
      user: { id: 'owner-3', email: 'owner@example.com', role: 'admin' },
    });

    await GET(request('job-9', '?include_debug=true'), context('job-9'));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/jobs/job-9?include_debug=true',
      { userId: 'owner-3', userRole: 'admin' },
      { timeoutMs: 25_000 },
    );
  });
});
