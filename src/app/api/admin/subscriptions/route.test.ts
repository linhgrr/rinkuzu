import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listSubscriptionsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listSubscriptionsMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/admin-billing-factory', () => ({
  getAdminBillingService: () => ({
    listSubscriptions: listSubscriptionsMock,
  }),
}));

import { dynamic, GET } from '@/app/api/admin/subscriptions/route';

const routeContext = { params: Promise.resolve({}) };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/subscriptions${query}`);
}

describe('GET /api/admin/subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('is force-dynamic and requires admin', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);
  });

  it('validates query params before listing', async () => {
    const response = await GET(request('?page=0&limit=20'), routeContext);
    expect(response.status).toBe(400);
    expect(listSubscriptionsMock).not.toHaveBeenCalled();
  });

  it('returns subscriptions on success and maps service failures', async () => {
    listSubscriptionsMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          subscriptions: [],
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
        error: 'Internal server error',
        statusCode: 500,
      });

    const ok = await GET(request('?page=1&limit=20&status=completed&search=alpha'), routeContext);
    expect(ok.status).toBe(200);
    expect(listSubscriptionsMock).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'completed',
      search: 'alpha',
    });

    const fail = await GET(request(), routeContext);
    expect(fail.status).toBe(500);
  });
});
