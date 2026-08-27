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
const CSRF_TOKEN = 'billing-csrf-token-for-tests';
const REVOKE_BODY = { action: 'revoke', reason: 'confirmed fraudulent payment' };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(body: unknown, id = subscriptionId, csrf = true): NextRequest {
  const url = `http://localhost/api/admin/subscriptions/${id}`;
  const headers = new Headers({ 'content-type': 'application/json' });
  if (csrf) {
    headers.set('origin', 'http://localhost');
    headers.set('sec-fetch-site', 'same-origin');
    headers.set('x-billing-csrf', CSRF_TOKEN);
    headers.set('cookie', `rk_billing_csrf=${CSRF_TOKEN}`);
  }
  return new NextRequest(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

describe('PATCH /api/admin/subscriptions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('is force-dynamic and requires admin', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await PATCH(request(REVOKE_BODY), routeContext)).status).toBe(401);
  });

  it('rejects a request without the billing CSRF double submit', async () => {
    const response = await PATCH(request(REVOKE_BODY, subscriptionId, false), routeContext);
    expect(response.status).toBe(403);
    expect(revokeEntitlementMock).not.toHaveBeenCalled();
  });

  it('validates route params and body before revoking', async () => {
    const badId = await PATCH(request(REVOKE_BODY, 'bad-id'), {
      params: Promise.resolve({ id: 'bad-id' }),
    });
    expect(badId.status).toBe(400);
    expect(revokeEntitlementMock).not.toHaveBeenCalled();

    // The old contract accepted an arbitrary target status; it never stored one.
    const legacyBody = await PATCH(request({ status: 'cancelled' }), routeContext);
    expect(legacyBody.status).toBe(400);

    const missingReason = await PATCH(request({ action: 'revoke' }), routeContext);
    expect(missingReason.status).toBe(400);
    expect(revokeEntitlementMock).not.toHaveBeenCalled();
  });

  it('revokes with the operator reason and maps service failures', async () => {
    revokeEntitlementMock
      .mockResolvedValueOnce({
        success: true,
        data: { id: subscriptionId, status: 'expired', isActive: false },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Entitlement account not found',
        statusCode: 404,
      });

    const ok = await PATCH(request(REVOKE_BODY), routeContext);
    expect(ok.status).toBe(200);
    expect(revokeEntitlementMock).toHaveBeenCalledWith(
      subscriptionId,
      'confirmed fraudulent payment',
    );

    const missing = await PATCH(request(REVOKE_BODY), routeContext);
    expect(missing.status).toBe(404);
  });
});
