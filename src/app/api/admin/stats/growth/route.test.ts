import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getGrowthTrendsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getGrowthTrendsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({ getGrowthTrends: getGrowthTrendsMock }),
  },
}));

import { GET } from '@/app/api/admin/stats/growth/route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/stats/growth${query}`);
}

describe('GET /api/admin/stats/growth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession);
    getGrowthTrendsMock.mockResolvedValue({
      success: true,
      data: {
        period: 30,
        from: '2026-06-29',
        to: '2026-07-28',
        data: [],
        comparison: {},
      },
    });
  });

  it('accepts only supported periods and defaults to 30 days', async () => {
    expect((await GET(request('?days=14'), routeContext)).status).toBe(400);
    expect(getGrowthTrendsMock).not.toHaveBeenCalled();

    expect((await GET(request(), routeContext)).status).toBe(200);
    expect(getGrowthTrendsMock).toHaveBeenLastCalledWith(30);

    expect((await GET(request('?days=365'), routeContext)).status).toBe(200);
    expect(getGrowthTrendsMock).toHaveBeenLastCalledWith(365);
  });

  it('forwards service unavailability without exposing internals', async () => {
    getGrowthTrendsMock.mockResolvedValueOnce({
      success: false,
      error: 'Statistics analytics are unavailable',
      statusCode: 503,
    });

    const response = await GET(request('?days=7'), routeContext);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'service_unavailable',
        detail: 'Statistics analytics are unavailable',
      },
    });
  });
});
