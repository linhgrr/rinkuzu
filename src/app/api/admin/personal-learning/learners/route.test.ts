import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, searchLearnersMock, consumeAdminRateLimitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  searchLearnersMock: vi.fn(),
  consumeAdminRateLimitMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-rate-limit', () => ({ consumeAdminRateLimit: consumeAdminRateLimitMock }));
vi.mock('@/lib/admin-user-identity-factory', () => ({
  getAdminUserIdentityService: () => ({ searchLearners: searchLearnersMock }),
}));

import { GET } from '@/app/api/admin/personal-learning/learners/route';

const routeContext = { params: Promise.resolve({}) };

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/personal-learning/learners${query}`);
}

describe('GET /api/admin/personal-learning/learners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    consumeAdminRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetSeconds: 60,
      limit: 30,
    });
    searchLearnersMock.mockResolvedValue({
      success: true,
      data: { learners: [{ id: 'user-a', displayName: 'A', email: 'a@example.com' }] },
    });
  });

  it('returns matches for an admin with private no-store caching', async () => {
    const response = await GET(request('?search=%20a%40example%20'), routeContext);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { learners: [{ id: 'user-a', displayName: 'A', email: 'a@example.com' }] },
    });
    expect(searchLearnersMock).toHaveBeenCalledWith('a@example');
    expect(consumeAdminRateLimitMock).toHaveBeenCalledWith('learner_search_user', 'admin-1');
  });

  it('rejects a missing, too-short or over-length search', async () => {
    for (const query of ['', '?search=a', `?search=${'x'.repeat(101)}`]) {
      expect((await GET(request(query), routeContext)).status).toBe(400);
    }
    expect(searchLearnersMock).not.toHaveBeenCalled();
  });

  it('refuses non-admin sessions before touching the rate limit or users', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    expect((await GET(request('?search=linh'), routeContext)).status).toBe(403);
    expect(consumeAdminRateLimitMock).not.toHaveBeenCalled();
    expect(searchLearnersMock).not.toHaveBeenCalled();
  });

  it('refuses unauthenticated requests', async () => {
    authMock.mockResolvedValue(null);

    expect((await GET(request('?search=linh'), routeContext)).status).toBe(401);
    expect(searchLearnersMock).not.toHaveBeenCalled();
  });

  it('returns 429 once the admin exhausts the search budget', async () => {
    consumeAdminRateLimitMock.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 12,
      limit: 30,
    });

    const response = await GET(request('?search=linh'), routeContext);

    expect(response.status).toBe(429);
    expect(searchLearnersMock).not.toHaveBeenCalled();
  });

  it('surfaces a lookup failure as a 500', async () => {
    searchLearnersMock.mockResolvedValue({
      success: false,
      error: 'Failed to search learners',
      statusCode: 500,
    });

    expect((await GET(request('?search=linh'), routeContext)).status).toBe(500);
  });

  it('returns 500 when the rate limiter itself fails', async () => {
    consumeAdminRateLimitMock.mockRejectedValue(new Error('mongo down'));

    expect((await GET(request('?search=linh'), routeContext)).status).toBe(500);
    expect(searchLearnersMock).not.toHaveBeenCalled();
  });
});
