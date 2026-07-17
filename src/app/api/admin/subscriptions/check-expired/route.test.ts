import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, checkAndUpdateExpiredSubscriptionsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  checkAndUpdateExpiredSubscriptionsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    checkAndUpdateExpiredSubscriptions: checkAndUpdateExpiredSubscriptionsMock,
  }),
}));

import { POST } from '@/app/api/admin/subscriptions/check-expired/route';

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(headers: HeadersInit = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/subscriptions/check-expired', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/admin/subscriptions/check-expired', () => {
  const originalSecret = process.env['SUBSCRIPTION_CRON_SECRET'];

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    checkAndUpdateExpiredSubscriptionsMock.mockResolvedValue(3);
    delete process.env['SUBSCRIPTION_CRON_SECRET'];
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env['SUBSCRIPTION_CRON_SECRET'];
    } else {
      process.env['SUBSCRIPTION_CRON_SECRET'] = originalSecret;
    }
  });

  it('allows admin sessions when cron secret is unset', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);

    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { updatedCount: 3 },
      meta: { message: 'Expired subscriptions checked and updated successfully' },
    });
    expect(checkAndUpdateExpiredSubscriptionsMock).toHaveBeenCalledOnce();
  });

  it('accepts a matching bearer cron secret without requiring admin session', async () => {
    process.env['SUBSCRIPTION_CRON_SECRET'] = 'cron-secret';
    authMock.mockResolvedValue(null);

    const response = await POST(request({ authorization: 'Bearer cron-secret' }));

    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
    expect(checkAndUpdateExpiredSubscriptionsMock).toHaveBeenCalledOnce();
  });

  it('falls back to admin auth when bearer token does not match the cron secret', async () => {
    process.env['SUBSCRIPTION_CRON_SECRET'] = 'cron-secret';

    const unauthorized = await POST(request({ authorization: 'Bearer wrong' }));
    // withAdmin still runs; admin session is present
    expect(unauthorized.status).toBe(200);
    expect(authMock).toHaveBeenCalled();

    authMock.mockResolvedValueOnce(null);
    expect((await POST(request({ authorization: 'Bearer wrong' }))).status).toBe(401);
  });

  it('strips Bearer prefix case-insensitively and supports no-space variants via regex', async () => {
    process.env['SUBSCRIPTION_CRON_SECRET'] = 'cron-secret';
    authMock.mockResolvedValue(null);

    const response = await POST(request({ authorization: 'bearer cron-secret' }));
    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('logs unexpected synchronous failures and returns a safe public error', async () => {
    const badRequest = new NextRequest('http://localhost/api/admin/subscriptions/check-expired', {
      method: 'POST',
    });
    Object.defineProperty(badRequest, 'headers', {
      configurable: true,
      value: {
        get: () => {
          throw new Error('headers unavailable');
        },
      },
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Error checking expired subscriptions',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        detail: 'Failed to check expired subscriptions',
      },
    });
  });
});
