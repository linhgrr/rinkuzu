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

import { DELETE, dynamic, GET } from '@/app/api/adaptive/history/[...path]/route';

const USER_ID = 'user-1';

function session(overrides?: { id?: string; role?: string }) {
  return {
    user: {
      id: overrides?.id ?? USER_ID,
      email: 'user@example.com',
      role: overrides?.role ?? 'user',
    },
  };
}

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(`http://localhost/api/adaptive/history/${path}`, init);
}

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('/api/adaptive/history/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('exports force-dynamic and requires authentication for GET and DELETE', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const getResponse = await GET(request('subjects/progress'), context(['subjects', 'progress']));
    const deleteResponse = await DELETE(
      request('subjects/job-1', { method: 'DELETE' }),
      context(['subjects', 'job-1']),
    );

    expect(getResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid GET path params without proxying', async () => {
    const response = await GET(request('sessions/x'), context(['sessions', 'x']));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies progress history with default limit and authenticated user context', async () => {
    authMock.mockResolvedValue(session({ role: 'admin' }));

    await GET(request('subjects/progress'), context(['subjects', 'progress']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/history/subjects/progress?limit=50',
      { userId: USER_ID, userRole: 'admin' },
    );
  });

  it('applies validated progress limit query values', async () => {
    await GET(request('subjects/progress?limit=12'), context(['subjects', 'progress']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/history/subjects/progress?limit=12',
      { userId: USER_ID, userRole: 'user' },
    );
  });

  it('rejects out-of-range progress limits before proxying', async () => {
    const response = await GET(
      request('subjects/progress?limit=0'),
      context(['subjects', 'progress']),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toBeDefined();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies subject detail GET by jobId without extra query constraints', async () => {
    await GET(request('subjects/job-42'), context(['subjects', 'job-42']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/history/subjects/job-42',
      { userId: USER_ID, userRole: 'user' },
    );
  });

  it('rejects subject GET with unexpected query keys', async () => {
    const response = await GET(
      request('subjects/job-42?limit=10'),
      context(['subjects', 'job-42']),
    );

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid DELETE path params without proxying', async () => {
    const response = await DELETE(
      request('progress/job-1', { method: 'DELETE' }),
      context(['progress', 'job-1']),
    );

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('defaults delete_sessions to true when the query is omitted', async () => {
    await DELETE(request('subjects/job-7', { method: 'DELETE' }), context(['subjects', 'job-7']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/history/subjects/job-7?delete_sessions=true',
      { userId: USER_ID, userRole: 'user' },
      { method: 'DELETE' },
    );
  });

  it('forwards delete_sessions=false when explicitly requested', async () => {
    await DELETE(
      request('subjects/job-7?delete_sessions=false', { method: 'DELETE' }),
      context(['subjects', 'job-7']),
    );

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/history/subjects/job-7?delete_sessions=false',
      { userId: USER_ID, userRole: 'user' },
      { method: 'DELETE' },
    );
  });

  it('rejects invalid delete_sessions values before proxying', async () => {
    const response = await DELETE(
      request('subjects/job-7?delete_sessions=yes', { method: 'DELETE' }),
      context(['subjects', 'job-7']),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
