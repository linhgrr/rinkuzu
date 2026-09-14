import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock, getUserIdentitiesMock, findUserIdsMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    proxyAdaptiveRequestMock: vi.fn(),
    getUserIdentitiesMock: vi.fn(),
    findUserIdsMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));
vi.mock('@/lib/admin-user-identity-factory', () => ({
  getAdminUserIdentityService: () => ({
    getUserIdentities: getUserIdentitiesMock,
    findUserIdsByNameOrEmail: findUserIdsMock,
  }),
}));

import { GET } from '@/app/api/admin/personal-learning/subjects/route';

const routeContext = { params: Promise.resolve({}) };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/personal-learning/subjects${query}`);
}

function upstream(subjects: Array<Record<string, unknown>>, nextCursor: string | null = null) {
  return new Response(
    JSON.stringify({ success: true, data: { subjects, next_cursor: nextCursor } }),
    { headers: { 'content-type': 'application/json' } },
  );
}

async function body(response: Response): Promise<{
  data: { subjects: Array<Record<string, unknown>>; next_cursor: string | null };
}> {
  return response.json();
}

describe('GET /api/admin/personal-learning/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    getUserIdentitiesMock.mockResolvedValue(new Map());
    findUserIdsMock.mockResolvedValue([]);
    proxyAdaptiveRequestMock.mockResolvedValue(upstream([]));
  });

  it('forwards allowlisted filters and forces private no-store', async () => {
    const response = await GET(
      request('?window=7d&pipeline_status=failed&progress_status=active&limit=10&cursor=abc'),
      routeContext,
    );

    expect(response.status).toBe(200);
    const [upstreamRequest, path, auth] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    const params = new URL(upstreamRequest.url).searchParams;
    expect(params.get('window')).toBe('7d');
    expect(params.get('pipeline_status')).toBe('failed');
    expect(params.get('progress_status')).toBe('active');
    expect(params.get('limit')).toBe('10');
    expect(params.get('cursor')).toBe('abc');
    expect(path).toBe('/admin/personal-learning/subjects');
    expect(auth).toEqual({ userId: 'admin-1', userRole: 'admin' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('widens a free-text search with the user ids it resolves', async () => {
    findUserIdsMock.mockResolvedValue(['user-a', 'user-b']);

    await GET(request('?search=linh'), routeContext);

    expect(findUserIdsMock).toHaveBeenCalledWith('linh', 100);
    const [upstreamRequest] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    const params = new URL(upstreamRequest.url).searchParams;
    expect(params.get('search')).toBe('linh');
    expect(params.getAll('user_ids')).toEqual(['user-a', 'user-b']);
  });

  it('enriches each row with the account display name and email', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(
      upstream([{ job_id: 'job-1', user_id: 'user-a' }], 'cursor-2'),
    );
    getUserIdentitiesMock.mockResolvedValue(
      new Map([['user-a', { id: 'user-a', email: 'a@example.com', displayName: 'Learner A' }]]),
    );

    const payload = await body(await GET(request(), routeContext));

    expect(getUserIdentitiesMock).toHaveBeenCalledWith(['user-a']);
    expect(payload.data.subjects[0]).toMatchObject({
      job_id: 'job-1',
      display_name: 'Learner A',
      email: 'a@example.com',
    });
    expect(payload.data.next_cursor).toBe('cursor-2');
  });

  it('keeps rows whose account is gone instead of failing the page', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(
      upstream([
        { job_id: 'job-1', user_id: 'deleted-user' },
        { job_id: 'job-2', user_id: null },
      ]),
    );

    const payload = await body(await GET(request(), routeContext));

    expect(payload.data.subjects).toEqual([
      { job_id: 'job-1', user_id: 'deleted-user', display_name: null, email: null },
      { job_id: 'job-2', user_id: null, display_name: null, email: null },
    ]);
  });

  it('rejects unsupported or unexpected query parameters', async () => {
    expect((await GET(request('?window=365d'), routeContext)).status).toBe(400);
    expect((await GET(request('?limit=500'), routeContext)).status).toBe(400);
    expect((await GET(request('?user_ids=someone'), routeContext)).status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('surfaces an upstream failure instead of an empty page', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code: 'upstream_error' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(503);
    expect(getUserIdentitiesMock).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('refuses non-admin sessions', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    expect((await GET(request(), routeContext)).status).toBe(403);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
