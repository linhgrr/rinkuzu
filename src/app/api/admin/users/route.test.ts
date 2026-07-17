import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getUsersMock,
  updateUserRoleMock,
  deleteUserMock,
  grantUserSubscriptionMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUsersMock: vi.fn(),
  updateUserRoleMock: vi.fn(),
  deleteUserMock: vi.fn(),
  grantUserSubscriptionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({
      getUsers: getUsersMock,
      updateUserRole: updateUserRoleMock,
      deleteUser: deleteUserMock,
    }),
  },
}));
vi.mock('@/lib/admin-billing-factory', () => ({
  getAdminBillingService: () => ({
    grantUserSubscription: grantUserSubscriptionMock,
  }),
}));

import { DELETE, GET, PATCH, POST } from '@/app/api/admin/users/route';

const userId = '507f1f77bcf86cd799439011';
const routeContext = { params: Promise.resolve({}) };

function adminSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      ...overrides,
    },
  };
}

function getRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users${query}`);
}

function jsonRequest(method: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/users', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  describe('GET', () => {
    it('requires admin access', async () => {
      authMock.mockResolvedValueOnce(null);
      expect((await GET(getRequest(), routeContext)).status).toBe(401);

      authMock.mockResolvedValueOnce(adminSession({ role: 'user' }));
      expect((await GET(getRequest(), routeContext)).status).toBe(403);
    });

    it('rejects invalid list query params', async () => {
      const response = await GET(getRequest('?page=0&limit=10'), routeContext);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'validation_error' },
      });
      expect(getUsersMock).not.toHaveBeenCalled();
    });

    it('returns listed users on success and maps service failures', async () => {
      getUsersMock
        .mockResolvedValueOnce({
          success: true,
          data: {
            users: [{ id: userId, email: 'u@example.com', role: 'user', createdAt: nowIso() }],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalItems: 1,
              itemsPerPage: 10,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Failed to list users',
          statusCode: 500,
        });

      const ok = await GET(getRequest('?page=1&limit=10&search=alpha&role=user'), routeContext);
      expect(ok.status).toBe(200);
      expect(getUsersMock).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'alpha',
        role: 'user',
      });

      const fail = await GET(getRequest(), routeContext);
      expect(fail.status).toBe(500);
    });
  });

  describe('PATCH', () => {
    it('validates body, updates role, and maps service/unexpected failures', async () => {
      const invalid = await PATCH(jsonRequest('PATCH', { userId, role: 'owner' }), routeContext);
      expect(invalid.status).toBe(400);
      expect(updateUserRoleMock).not.toHaveBeenCalled();

      updateUserRoleMock.mockResolvedValueOnce({
        success: true,
        data: { message: 'Role updated' },
      });
      const ok = await PATCH(jsonRequest('PATCH', { userId, role: 'admin' }), routeContext);
      expect(ok.status).toBe(200);
      expect(updateUserRoleMock).toHaveBeenCalledWith(userId, 'admin', 'admin@example.com');

      updateUserRoleMock.mockResolvedValueOnce({
        success: false,
        error: 'User not found',
        statusCode: 404,
      });
      const missing = await PATCH(jsonRequest('PATCH', { userId, role: 'user' }), routeContext);
      expect(missing.status).toBe(404);

      updateUserRoleMock.mockRejectedValueOnce(new Error('db down'));
      const boom = await PATCH(jsonRequest('PATCH', { userId, role: 'user' }), routeContext);
      expect(boom.status).toBe(500);
      expect(loggerErrorMock).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Update user role error',
      );
    });
  });

  describe('DELETE', () => {
    it('validates userId, deletes users, and maps service/unexpected failures', async () => {
      const invalid = await DELETE(getRequest('?userId=not-an-id'), routeContext);
      expect(invalid.status).toBe(400);
      expect(deleteUserMock).not.toHaveBeenCalled();

      deleteUserMock.mockResolvedValueOnce({
        success: true,
        data: { id: userId, deleted: true },
      });
      const ok = await DELETE(getRequest(`?userId=${userId}`), routeContext);
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toMatchObject({
        success: true,
        meta: { message: 'User deleted successfully' },
      });
      expect(deleteUserMock).toHaveBeenCalledWith(userId, 'admin@example.com');

      deleteUserMock.mockResolvedValueOnce({
        success: false,
        error: 'Cannot delete yourself',
        statusCode: 400,
      });
      expect((await DELETE(getRequest(`?userId=${userId}`), routeContext)).status).toBe(400);

      deleteUserMock.mockRejectedValueOnce(new Error('delete failed'));
      const boom = await DELETE(getRequest(`?userId=${userId}`), routeContext);
      expect(boom.status).toBe(500);
      expect(loggerErrorMock).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Delete user error',
      );
    });
  });

  describe('POST', () => {
    it('validates grant payload and delegates to billing service', async () => {
      const invalid = await POST(jsonRequest('POST', { userId: 'bad', planId: '' }), routeContext);
      expect(invalid.status).toBe(400);
      expect(grantUserSubscriptionMock).not.toHaveBeenCalled();

      grantUserSubscriptionMock
        .mockResolvedValueOnce({
          success: true,
          data: {
            user: 'user@example.com',
            plan: 'Premium',
            startDate: nowIso(),
            isActive: true,
          },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Plan not found',
          statusCode: 404,
        });

      const ok = await POST(jsonRequest('POST', { userId, planId: 'premium-p1m' }), routeContext);
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toMatchObject({
        success: true,
        meta: { message: 'Subscription added successfully' },
      });
      expect(grantUserSubscriptionMock).toHaveBeenCalledWith({
        userId,
        planId: 'premium-p1m',
      });

      const fail = await POST(jsonRequest('POST', { userId, planId: 'premium-p1m' }), routeContext);
      expect(fail.status).toBe(404);
    });
  });
});

function nowIso() {
  return '2026-07-01T00:00:00.000Z';
}
