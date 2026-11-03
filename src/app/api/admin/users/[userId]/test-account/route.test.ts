import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, setTestAccountMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  setTestAccountMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getAdminTestAccountService: () => ({ setTestAccount: setTestAccountMock }),
}));

import { PATCH } from '@/app/api/admin/users/[userId]/test-account/route';

const userId = '507f1f77bcf86cd799439011';
const adminId = '507f1f77bcf86cd799439012';

function session(role = 'admin') {
  return { user: { id: adminId, email: 'admin@example.test', role } };
}

function routeContext(id = userId) {
  return { params: Promise.resolve({ userId: id }) };
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${userId}/test-account`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/users/[userId]/test-account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
  });

  it('rejects anonymous callers with 401 and non-admins with 403', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await PATCH(jsonRequest({ isTestAccount: true }), routeContext())).status).toBe(401);

    authMock.mockResolvedValueOnce(session('user'));
    expect((await PATCH(jsonRequest({ isTestAccount: true }), routeContext())).status).toBe(403);
    expect(setTestAccountMock).not.toHaveBeenCalled();
  });

  it('validates the route param and a strict boolean body', async () => {
    for (const [body, id] of [
      [{ isTestAccount: true }, 'not-an-id'],
      [{ isTestAccount: 'true' }, userId],
      [{}, userId],
      [{ isTestAccount: true, email: 'x' }, userId],
    ] as const) {
      expect((await PATCH(jsonRequest(body), routeContext(id))).status).toBe(400);
    }
    expect(setTestAccountMock).not.toHaveBeenCalled();
  });

  it('delegates to the service with the admin actor and returns its result', async () => {
    setTestAccountMock.mockResolvedValueOnce({
      success: true,
      data: { id: userId, isTestAccount: true, changed: true },
    });

    const response = await PATCH(jsonRequest({ isTestAccount: true }), routeContext());

    expect(response.status).toBe(200);
    expect(setTestAccountMock).toHaveBeenCalledWith(userId, true, {
      id: adminId,
      email: 'admin@example.test',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: userId, isTestAccount: true, changed: true },
    });
  });

  it('maps service failures and unexpected errors', async () => {
    setTestAccountMock.mockResolvedValueOnce({
      success: false,
      error: 'User not found',
      statusCode: 404,
    });
    expect((await PATCH(jsonRequest({ isTestAccount: false }), routeContext())).status).toBe(404);

    setTestAccountMock.mockRejectedValueOnce(new Error('db down'));
    expect((await PATCH(jsonRequest({ isTestAccount: false }), routeContext())).status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Update user test account error',
    );
  });
});
