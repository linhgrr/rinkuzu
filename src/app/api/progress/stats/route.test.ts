import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getDashboardStatsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getDashboardStatsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/dashboard-factory', () => ({
  getDashboardStats: getDashboardStatsMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET, dynamic } from '@/app/api/progress/stats/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

describe('GET /api/progress/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getDashboardStatsMock.mockResolvedValue({
      totalAttempts: 12,
      averageScore: 81,
      currentStreak: 3,
    });
  });

  it('is force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/progress/stats'),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(getDashboardStatsMock).not.toHaveBeenCalled();
  });

  it('returns dashboard stats for the authenticated user', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/progress/stats'),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(getDashboardStatsMock).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        totalAttempts: 12,
        averageScore: 81,
        currentStreak: 3,
      },
    });
  });

  it('maps unexpected failures to a safe 500 and logs the error object', async () => {
    getDashboardStatsMock.mockRejectedValueOnce(new Error('stats unavailable'));

    const response = await GET(
      new NextRequest('http://localhost/api/progress/stats'),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal Server Error' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error fetching progress stats',
    );
  });
});
