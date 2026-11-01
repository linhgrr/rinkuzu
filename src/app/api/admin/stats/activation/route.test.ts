import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getWeeklyActivationMock, adminServiceMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getWeeklyActivationMock: vi.fn(),
  adminServiceMock: {
    getStats: vi.fn(),
    getActivityStats: vi.fn(),
    getCreatorStats: vi.fn(),
    getScoreStats: vi.fn(),
    getGrowthTrends: vi.fn(),
  },
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getActivationStatsService: () => ({ getWeeklyActivation: getWeeklyActivationMock }),
  getAdminService: () => adminServiceMock,
}));

import { GET } from '@/app/api/admin/stats/activation/route';
import { GET as GET_ADMIN_STATS } from '@/app/api/admin/stats/route';

const TOKEN = 'fake-analytics-token-0123456789abcdef';
const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
const userSession = { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };

function request(path: string, authorization?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('GET /api/admin/stats/activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    authMock.mockResolvedValue(null);
    getWeeklyActivationMock.mockResolvedValue({ success: true, data: { weeks: [] } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 without a session or token', async () => {
    const response = await GET(request('/api/admin/stats/activation'), routeContext);
    expect(response.status).toBe(401);
    expect(getWeeklyActivationMock).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong token and 403 for a non-admin session', async () => {
    expect(
      (await GET(request('/api/admin/stats/activation', 'Bearer wrong'), routeContext)).status,
    ).toBe(401);
    authMock.mockResolvedValue(userSession);
    expect((await GET(request('/api/admin/stats/activation'), routeContext)).status).toBe(403);
    expect(getWeeklyActivationMock).not.toHaveBeenCalled();
  });

  it('serves an admin session as the admin actor with default weeks', async () => {
    authMock.mockResolvedValue(adminSession);
    const response = await GET(request('/api/admin/stats/activation'), routeContext);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(getWeeklyActivationMock).toHaveBeenCalledWith(8, {
      kind: 'admin',
      userId: 'admin-1',
      email: 'admin@example.com',
    });
  });

  it('serves a valid token as the service actor without a session', async () => {
    const response = await GET(
      request('/api/admin/stats/activation?weeks=26', `Bearer ${TOKEN}`),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
    expect(getWeeklyActivationMock).toHaveBeenCalledWith(26, { kind: 'service' });
  });

  it('rejects out-of-range weeks', async () => {
    for (const weeks of ['0', '27', 'abc', '2.5']) {
      const response = await GET(
        request(`/api/admin/stats/activation?weeks=${weeks}`, `Bearer ${TOKEN}`),
        routeContext,
      );
      expect(response.status).toBe(400);
    }
    expect(getWeeklyActivationMock).not.toHaveBeenCalled();
  });

  it('maps a service failure to 500', async () => {
    getWeeklyActivationMock.mockResolvedValue({
      success: false,
      error: 'Failed to get activation statistics',
      statusCode: 500,
    });
    const response = await GET(
      request('/api/admin/stats/activation', `Bearer ${TOKEN}`),
      routeContext,
    );
    expect(response.status).toBe(500);
  });

  it('does not unlock any other admin route', async () => {
    const response = await GET_ADMIN_STATS(
      request('/api/admin/stats', `Bearer ${TOKEN}`),
      routeContext,
    );
    expect(response.status).toBe(401);
    expect(adminServiceMock.getStats).not.toHaveBeenCalled();
  });
});
