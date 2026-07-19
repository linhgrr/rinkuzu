import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, setUserDisableMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  setUserDisableMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({
      setUserDisable: setUserDisableMock,
    }),
  },
}));

import { PATCH } from '@/app/api/admin/users/[userId]/status/route';

const userId = '507f1f77bcf86cd799439011';
const adminId = '507f1f77bcf86cd799439012';

function adminSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: adminId,
      email: 'admin@example.com',
      role: 'admin',
      ...overrides,
    },
  };
}

function routeContext(id = userId) {
  return { params: Promise.resolve({ userId: id }) };
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/users/[userId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('requires admin access', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await PATCH(jsonRequest({ disable: 1 }), routeContext())).status).toBe(401);
  });

  it('validates route params and body disable literal', async () => {
    const badId = await PATCH(jsonRequest({ disable: 1 }), routeContext('not-an-id'));
    expect(badId.status).toBe(400);
    expect(setUserDisableMock).not.toHaveBeenCalled();

    const badBody = await PATCH(jsonRequest({ disable: 2 }), routeContext());
    expect(badBody.status).toBe(400);
    expect(setUserDisableMock).not.toHaveBeenCalled();
  });

  it('delegates disable/restore to setUserDisable with actor context', async () => {
    setUserDisableMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: userId,
        disable: 1,
        changed: true,
        message: 'User disabled successfully',
      },
    });

    const response = await PATCH(jsonRequest({ disable: 1 }), routeContext());
    expect(response.status).toBe(200);
    expect(setUserDisableMock).toHaveBeenCalledWith(userId, 1, {
      id: adminId,
      email: 'admin@example.com',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      meta: { message: 'User disabled successfully' },
    });
  });

  it('maps service and unexpected failures including invariant codes', async () => {
    setUserDisableMock.mockResolvedValueOnce({
      success: false,
      error: 'Cannot remove or disable the last active admin',
      statusCode: 409,
      code: 'last_active_admin',
    });
    const lastAdmin = await PATCH(jsonRequest({ disable: 1 }), routeContext());
    expect(lastAdmin.status).toBe(409);
    await expect(lastAdmin.json()).resolves.toMatchObject({
      error: { code: 'last_active_admin' },
    });

    setUserDisableMock.mockResolvedValueOnce({
      success: false,
      error: 'Active-admin invariant is unavailable',
      statusCode: 503,
      code: 'admin_invariant_unavailable',
    });
    const unavailable = await PATCH(jsonRequest({ disable: 1 }), routeContext());
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: 'admin_invariant_unavailable' },
    });

    setUserDisableMock.mockRejectedValueOnce(new Error('db down'));
    expect((await PATCH(jsonRequest({ disable: 0 }), routeContext())).status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Update user status error',
    );
  });
});
