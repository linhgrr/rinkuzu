import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listPlansMock, createPlanMock, updatePlanMock, deletePlanMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    listPlansMock: vi.fn(),
    createPlanMock: vi.fn(),
    updatePlanMock: vi.fn(),
    deletePlanMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/admin-billing-factory', () => ({
  getAdminBillingService: () => ({
    listPlans: listPlansMock,
    createPlan: createPlanMock,
    updatePlan: updatePlanMock,
    deletePlan: deletePlanMock,
  }),
}));

import { DELETE, GET, PATCH, POST } from '@/app/api/admin/plans/route';

const routeContext = { params: Promise.resolve({}) };
const plan = {
  id: 'premium-p1m',
  name: 'Premium',
  price: 99000,
  duration: 'P1M',
  isActive: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

const CSRF_TOKEN = 'billing-csrf-token-for-tests';

function jsonRequest(method: string, body: unknown, csrf = true): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (csrf) {
    headers.set('origin', 'http://localhost');
    headers.set('sec-fetch-site', 'same-origin');
    headers.set('x-billing-csrf', CSRF_TOKEN);
    headers.set('cookie', `rk_billing_csrf=${CSRF_TOKEN}`);
  }
  return new NextRequest('http://localhost/api/admin/plans', {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

describe('/api/admin/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('requires admin on all verbs', async () => {
    authMock.mockResolvedValue(null);
    expect(
      (await GET(new NextRequest('http://localhost/api/admin/plans'), routeContext)).status,
    ).toBe(401);
    expect((await POST(jsonRequest('POST', {}), routeContext)).status).toBe(401);
    expect((await PATCH(jsonRequest('PATCH', {}), routeContext)).status).toBe(401);
    expect((await DELETE(jsonRequest('DELETE', {}), routeContext)).status).toBe(401);
  });

  it('rejects a plan mutation without the billing CSRF double submit', async () => {
    // Plan price drives every future quote, so plan writes carry the same
    // same-origin boundary as the rest of billing.
    for (const [handler, method] of [
      [POST, 'POST'],
      [PATCH, 'PATCH'],
      [DELETE, 'DELETE'],
    ] as const) {
      const response = await handler(jsonRequest(method, { id: 'plan_x' }, false), routeContext);
      expect(response.status).toBe(403);
    }
    expect(createPlanMock).not.toHaveBeenCalled();
    expect(updatePlanMock).not.toHaveBeenCalled();
    expect(deletePlanMock).not.toHaveBeenCalled();
  });

  it('lists plans and maps service failures', async () => {
    listPlansMock
      .mockResolvedValueOnce({ success: true, data: [plan] })
      .mockResolvedValueOnce({ success: false, error: 'Internal server error', statusCode: 500 });

    const ok = await GET(new NextRequest('http://localhost/api/admin/plans'), routeContext);
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toEqual({ success: true, data: [plan] });

    const fail = await GET(new NextRequest('http://localhost/api/admin/plans'), routeContext);
    expect(fail.status).toBe(500);
  });

  it('validates create payloads and returns 201 on success', async () => {
    const invalid = await POST(jsonRequest('POST', { name: '', price: -1 }), routeContext);
    expect(invalid.status).toBe(400);
    expect(createPlanMock).not.toHaveBeenCalled();

    createPlanMock.mockResolvedValueOnce({ success: true, data: plan }).mockResolvedValueOnce({
      success: false,
      error: 'A plan with this name and duration already exists',
      statusCode: 409,
    });

    const ok = await POST(
      jsonRequest('POST', {
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
        isActive: true,
      }),
      routeContext,
    );
    expect(ok.status).toBe(201);
    expect(createPlanMock).toHaveBeenCalledWith({
      name: 'Premium',
      price: 99000,
      duration: 'P1M',
      isActive: true,
    });

    const conflict = await POST(
      jsonRequest('POST', {
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
      }),
      routeContext,
    );
    expect(conflict.status).toBe(409);
  });

  it('validates update payloads and maps not-found', async () => {
    const invalid = await PATCH(jsonRequest('PATCH', { id: 'premium-p1m' }), routeContext);
    expect(invalid.status).toBe(400);
    expect(updatePlanMock).not.toHaveBeenCalled();

    updatePlanMock
      .mockResolvedValueOnce({ success: true, data: { ...plan, name: 'Pro' } })
      .mockResolvedValueOnce({ success: false, error: 'Plan not found', statusCode: 404 });

    const ok = await PATCH(jsonRequest('PATCH', { id: 'premium-p1m', name: 'Pro' }), routeContext);
    expect(ok.status).toBe(200);
    expect(updatePlanMock).toHaveBeenCalledWith({ id: 'premium-p1m', name: 'Pro' });

    const missing = await PATCH(jsonRequest('PATCH', { id: 'missing', name: 'Pro' }), routeContext);
    expect(missing.status).toBe(404);
  });

  it('validates delete payloads and returns success meta', async () => {
    const invalid = await DELETE(jsonRequest('DELETE', { id: '' }), routeContext);
    expect(invalid.status).toBe(400);
    expect(deletePlanMock).not.toHaveBeenCalled();

    deletePlanMock
      .mockResolvedValueOnce({ success: true, data: { id: 'premium-p1m', deleted: true } })
      .mockResolvedValueOnce({
        success: false,
        error: 'An assigned plan cannot be deleted; deactivate it instead',
        statusCode: 409,
      });

    const ok = await DELETE(jsonRequest('DELETE', { id: 'premium-p1m' }), routeContext);
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({
      success: true,
      meta: { message: 'Plan deleted successfully' },
    });
    expect(deletePlanMock).toHaveBeenCalledWith('premium-p1m');

    const inUse = await DELETE(jsonRequest('DELETE', { id: 'premium-p1m' }), routeContext);
    expect(inUse.status).toBe(409);
  });
});
