import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revokeEntitlementMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revokeEntitlementMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/entitlement-admin-factory', () => ({
  createEntitlementAdminService: () => ({
    revoke: revokeEntitlementMock,
  }),
}));

import { dynamic, PATCH } from '@/app/api/admin/subscriptions/[id]/route';

const subscriptionId = '507f1f77bcf86cd799439011';
const routeContext = { params: Promise.resolve({ id: subscriptionId }) };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(body: unknown, id = subscriptionId): NextRequest {
  return new NextRequest(`http://localhost/api/admin/subscriptions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/subscriptions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('is force-dynamic and requires admin', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await PATCH(request({ status: 'cancelled' }), routeContext)).status).toBe(401);
  });

  it('validates route params and body before updating', async () => {
    const badId = await PATCH(request({ status: 'cancelled' }, 'bad-id'), {
      params: Promise.resolve({ id: 'bad-id' }),
    });
    expect(badId.status).toBe(400);
    expect(revokeEntitlementMock).not.toHaveBeenCalled();

    const badBody = await PATCH(request({ status: 'completed' }), routeContext);
    expect(badBody.status).toBe(400);
    expect(revokeEntitlementMock).not.toHaveBeenCalled();
  });

  it('updates subscription status and maps service failures', async () => {
    revokeEntitlementMock
      .mockResolvedValueOnce({
        success: true,
        data: { id: subscriptionId, status: 'cancelled' },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Entitlement account not found',
        statusCode: 404,
      });

    const ok = await PATCH(request({ status: 'cancelled' }), routeContext);
    expect(ok.status).toBe(200);
    expect(revokeEntitlementMock).toHaveBeenCalledWith(subscriptionId, 'cancelled');

    const missing = await PATCH(request({ status: 'expired' }), routeContext);
    expect(missing.status).toBe(404);
  });
});
