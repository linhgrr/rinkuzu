import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getStatsMock,
  getActivityStatsMock,
  getCreatorStatsMock,
  getScoreStatsMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getStatsMock: vi.fn(),
  getActivityStatsMock: vi.fn(),
  getCreatorStatsMock: vi.fn(),
  getScoreStatsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({
      getStats: getStatsMock,
      getActivityStats: getActivityStatsMock,
      getCreatorStats: getCreatorStatsMock,
      getScoreStats: getScoreStatsMock,
    }),
  },
}));

import { GET, dynamic } from '@/app/api/admin/stats/route';

const request = new NextRequest('http://localhost/api/admin/stats');
const routeContext = { params: Promise.resolve({}) };

function ok<T>(data: T) {
  return { success: true as const, data };
}

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    getStatsMock.mockResolvedValue(ok({ totalUsers: 10, totalQuizzes: 4 }));
    getActivityStatsMock.mockResolvedValue(
      ok({
        recentActivity: { users: [], quizzes: [], attempts: [] },
        activityBuckets: [],
      }),
    );
    getCreatorStatsMock.mockResolvedValue(
      ok({ creators: [{ id: 'creator-1', email: 'c@example.com' }], pagination: {} }),
    );
    getScoreStatsMock.mockResolvedValue(
      ok({ averageScore: 80, highestScore: 100, lowestScore: 10 }),
    );
  });

  it('requires admin and combines overview, activity, top creators, and score stats', async () => {
    expect(dynamic).toBe('force-dynamic');

    authMock.mockResolvedValueOnce(null);
    expect((await GET(request, routeContext)).status).toBe(401);

    authMock.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    expect((await GET(request, routeContext)).status).toBe(403);

    const response = await GET(request, routeContext);
    expect(response.status).toBe(200);
    expect(getCreatorStatsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        overview: { totalUsers: 10, totalQuizzes: 4 },
        recentActivity: { users: [], quizzes: [], attempts: [] },
        activityBuckets: [],
        topCreators: [{ id: 'creator-1', email: 'c@example.com' }],
        scoreStats: { averageScore: 80, highestScore: 100, lowestScore: 10 },
        growthTrends: { users: [], quizzes: [], attempts: [] },
      },
    });
  });

  it('fails closed when any combined service call is unsuccessful', async () => {
    getActivityStatsMock.mockResolvedValueOnce({
      success: false,
      code: 'stats_unavailable',
      error: 'activity down',
      statusCode: 503,
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch statistics' },
    });
  });

  it('logs unexpected errors and returns the public statistics failure message', async () => {
    getStatsMock.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await GET(request, routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Error fetching admin stats',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { detail: 'Failed to fetch statistics' },
    });
  });
});
