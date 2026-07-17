import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getSubscriptionStatusMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSubscriptionStatusMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    getSubscriptionStatus: getSubscriptionStatusMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { dynamic, GET } from '@/app/api/subscription/status/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/subscription/status');
}

describe('GET /api/subscription/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
  });

  it('is force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);
    expect(getSubscriptionStatusMock).not.toHaveBeenCalled();
  });

  it('returns the subscription status with no-store cache headers', async () => {
    getSubscriptionStatusMock.mockResolvedValue({
      isActive: true,
      planId: 'premium-p1m',
      endDate: '2026-08-01T00:00:00.000Z',
    });

    const response = await GET(request(), routeContext);

    expect(getSubscriptionStatusMock).toHaveBeenCalledWith('user-1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        isActive: true,
        planId: 'premium-p1m',
        endDate: '2026-08-01T00:00:00.000Z',
      },
    });
  });

  it('logs unexpected failures and returns a safe public error', async () => {
    getSubscriptionStatusMock.mockRejectedValueOnce(new Error('status down'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Error fetching subscription status',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch subscription status' },
    });
  });
});
