import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getReportsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getReportsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({
      getReports: getReportsMock,
    }),
  },
}));

import { dynamic, GET } from '@/app/api/admin/reports/route';

const routeContext = { params: Promise.resolve({}) };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports${query}`);
}

describe('GET /api/admin/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('is force-dynamic and requires admin', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);
  });

  it('validates query params before calling the service', async () => {
    const response = await GET(request('?page=0'), routeContext);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(getReportsMock).not.toHaveBeenCalled();
  });

  it('returns reports on success and maps service failures', async () => {
    getReportsMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          reports: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: 20,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Reports unavailable',
        statusCode: 503,
      });

    const ok = await GET(request('?page=1&limit=20&status=pending'), routeContext);
    expect(ok.status).toBe(200);
    expect(getReportsMock).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'pending' });

    const fail = await GET(request(), routeContext);
    expect(fail.status).toBe(503);
  });

  it('logs unexpected errors and returns a safe public message', async () => {
    getReportsMock.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Error fetching reports',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal server error' },
    });
  });
});
