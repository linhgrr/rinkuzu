import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, changePasswordMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  changePasswordMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/account-factory', () => ({
  getAccountService: () => ({
    changePassword: changePasswordMock,
  }),
}));

import { PUT } from '@/app/api/user/password/route';

const routeContext = { params: Promise.resolve({}) };

function session(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      ...overrides,
    },
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/password', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/user/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
  });

  it('requires authentication before changing a password', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await PUT(request({}), routeContext)).status).toBe(401);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('rejects invalid password payloads without calling the service', async () => {
    const response = await PUT(
      request({ currentPassword: 'oldpass12', newPassword: 'short' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('changes the password and returns success meta', async () => {
    changePasswordMock.mockResolvedValue({
      success: true,
      data: { updated: true },
    });

    const response = await PUT(
      request({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
      routeContext,
    );

    expect(changePasswordMock).toHaveBeenCalledWith('user@example.com', 'oldpass12', 'newpass12');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { updated: true },
      meta: { message: 'Password updated successfully' },
    });
  });

  it('maps service failures through apiServiceErr', async () => {
    changePasswordMock.mockResolvedValue({
      success: false,
      error: 'Current password is incorrect',
      statusCode: 400,
    });

    const response = await PUT(
      request({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { detail: 'Current password is incorrect' },
    });
  });

  it('keeps the password_not_set code for an account without a password', async () => {
    changePasswordMock.mockResolvedValue({
      success: false,
      error: 'Password change is not available for this account',
      statusCode: 400,
      code: 'password_not_set',
    });

    const response = await PUT(
      request({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'password_not_set' } });
  });
});
