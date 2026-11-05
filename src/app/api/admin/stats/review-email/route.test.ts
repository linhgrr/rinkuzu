import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getWeeklyMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getWeeklyMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getReviewEmailStatsService: () => ({ getWeekly: getWeeklyMock }),
}));

import { GET } from '@/app/api/admin/stats/review-email/route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
const STATS = {
  generatedAt: '2026-11-05T12:00:00.000Z',
  timezone: 'UTC',
  opensTracked: true,
  weeks: [
    {
      isoWeek: '2026-W45',
      start: '2026-11-02T00:00:00.000Z',
      end: '2026-11-08T23:59:59.999Z',
      sent: 4,
      opened: 2,
      unsubscribed: 1,
      optIns: 3,
    },
  ],
};

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/stats/review-email${query}`);
}

describe('GET /api/admin/stats/review-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession);
    getWeeklyMock.mockResolvedValue({ success: true, data: STATS });
  });

  it('rejects signed-out users and non-admins before reading any count', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);

    authMock.mockResolvedValueOnce({ user: { id: 'u-1', email: 'u@example.com', role: 'user' } });
    expect((await GET(request(), routeContext)).status).toBe(403);

    expect(getWeeklyMock).not.toHaveBeenCalled();
  });

  it('returns the weekly aggregates, 8 weeks by default, never cached publicly', async () => {
    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getWeeklyMock).toHaveBeenCalledWith(8);
    await expect(response.json()).resolves.toMatchObject({ data: STATS });
  });

  it('validates the week window', async () => {
    expect((await GET(request('?weeks=0'), routeContext)).status).toBe(400);
    expect((await GET(request('?weeks=27'), routeContext)).status).toBe(400);
    expect((await GET(request('?weeks=12'), routeContext)).status).toBe(200);
    expect(getWeeklyMock).toHaveBeenLastCalledWith(12);
  });

  it('answers a failed read with a generic 500', async () => {
    getWeeklyMock.mockResolvedValueOnce({
      success: false,
      error: 'Failed to get review email statistics',
      statusCode: 500,
    });

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to get review email statistics' },
    });
  });
});
