import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, reconcileMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  reconcileMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({ reconcilePaymentCancellation: reconcileMock }),
}));

import { POST } from '@/app/api/subscription/cancel-payment/route';

const routeContext = { params: Promise.resolve({}) };

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/subscription/cancel-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/subscription/cancel-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    reconcileMock.mockResolvedValue({ success: true, data: { status: 'cancelled' } });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ orderCode: 123 }), routeContext);

    expect(response.status).toBe(401);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('rejects malformed order codes', async () => {
    const response = await POST(request({ orderCode: 'not-a-number' }), routeContext);

    expect(response.status).toBe(400);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('reconciles the authenticated user order', async () => {
    const response = await POST(request({ orderCode: '456' }), routeContext);

    expect(reconcileMock).toHaveBeenCalledWith(456, 'user-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { status: 'cancelled' },
    });
  });

  it('preserves stable service error codes and statuses', async () => {
    reconcileMock.mockResolvedValue({
      success: false,
      error: 'Payment order does not belong to the current user',
      statusCode: 403,
      code: 'forbidden',
    });

    const response = await POST(request({ orderCode: 456 }), routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } });
  });
});
