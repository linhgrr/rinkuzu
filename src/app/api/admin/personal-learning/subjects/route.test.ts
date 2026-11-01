import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock, recordMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));
vi.mock('@/repositories/AdminAuditRepository', () => ({
  AdminAuditRepository: class {
    record = recordMock;
  },
}));

import { GET } from '@/app/api/admin/personal-learning/subjects/route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = {
  user: { id: '65f000000000000000000001', email: 'admin@example.com', role: 'admin' },
};
const learnerId = '65f0000000000000000000aa';

const subject = {
  job_id: 'job-1',
  filename: 'biology-notes.pdf',
  pipeline_status: 'completed',
  progress_status: 'active',
  accuracy: 0.75,
  progress_percent: 40,
  last_activity_at: '2026-10-30T10:00:00Z',
};

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/personal-learning/subjects${query}`);
}

function upstreamOk(subjects: unknown[], nextCursor: string | null = null): Response {
  return new Response(
    JSON.stringify({ success: true, data: { subjects, next_cursor: nextCursor } }),
    { headers: { 'content-type': 'application/json' } },
  );
}

describe('GET /api/admin/personal-learning/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession);
    recordMock.mockResolvedValue(undefined);
    proxyAdaptiveRequestMock.mockResolvedValue(upstreamOk([subject], 'cursor-2'));
  });

  it('records exactly one audit entry from the session and returns allowlisted fields', async () => {
    const response = await GET(
      request(`?user_id=${learnerId}&window=30d&progress_status=active&limit=10`),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(await response.json()).toEqual({
      success: true,
      data: { subjects: [subject], next_cursor: 'cursor-2' },
    });

    const [upstreamRequest, path, auth] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(path).toBe('/admin/personal-learning/subjects');
    expect(auth).toEqual({ userId: adminSession.user.id, userRole: 'admin' });
    expect(Object.fromEntries(new URL(upstreamRequest.url).searchParams)).toEqual({
      user_id: learnerId,
      window: '30d',
      progress_status: 'active',
      limit: '10',
    });

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({
      actorId: adminSession.user.id,
      actorEmail: adminSession.user.email,
      action: 'personal_learning.learner_view',
      entityType: 'user',
      entityId: learnerId,
      details: {
        window: '30d',
        pipeline_status: 'any',
        progress_status: 'active',
        limit: '10',
        page: 'first',
      },
    });
  });

  it('strips fields upstream adds beyond the allowlist', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(
      upstreamOk([{ ...subject, error_message: 'trace', password_hash: 'x', user_id: learnerId }]),
    );

    const body = await (await GET(request(`?user_id=${learnerId}`), routeContext)).json();

    expect(body.data.subjects).toEqual([subject]);
  });

  it('withholds learner data with a 5xx when the audit write fails', async () => {
    recordMock.mockRejectedValue(new Error('mongo down'));

    const response = await GET(request(`?user_id=${learnerId}`), routeContext);

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('biology-notes.pdf');
    expect(text).not.toContain('job-1');
  });

  it('passes upstream errors through without recording a view', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code: 'validation_error' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(request(`?user_id=${learnerId}&cursor=bad`), routeContext);

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('returns 502 without recording a view when upstream sends an unexpected body', async () => {
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('<html>', { status: 200 }));

    const response = await GET(request(`?user_id=${learnerId}`), routeContext);

    expect(response.status).toBe(502);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('denies non-admins before any upstream call or audit write', async () => {
    authMock.mockResolvedValue({ user: { ...adminSession.user, role: 'user' } });

    const response = await GET(request(`?user_id=${learnerId}`), routeContext);

    expect(response.status).toBe(403);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('rejects missing, out-of-range, or unexpected query parameters', async () => {
    for (const query of [
      '',
      '?user_id=%20%20',
      `?user_id=${'a'.repeat(129)}`,
      `?user_id=${learnerId}&limit=101`,
      `?user_id=${learnerId}&window=365d`,
      `?user_id=${learnerId}&pipeline_status=bogus`,
      `?user_id=${learnerId}&cursor=${'c'.repeat(513)}`,
      `?user_id=${learnerId}&email=someone@example.com`,
    ]) {
      expect((await GET(request(query), routeContext)).status, query).toBe(400);
    }
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });
});
