import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, createPaymentRequestMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createPaymentRequestMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    createPaymentRequest: createPaymentRequestMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/subscription/create-payment/route';

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/subscription/create-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({}) };

const paymentData = {
  orderCode: 12345,
  paymentUrl: 'https://pay.example/checkout',
  amount: 99000,
  plan: {
    id: 'premium-monthly',
    name: 'Premium',
    price: 99000,
    duration: 'P1M',
  },
};

describe('POST /api/subscription/create-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    createPaymentRequestMock.mockResolvedValue(paymentData);
  });

  it('requires authentication before creating a payment', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ planId: 'premium-monthly' }), routeContext);

    expect(response.status).toBe(401);
    expect(createPaymentRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid plan payloads without calling the service', async () => {
    const response = await POST(request({ planId: '' }), routeContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(createPaymentRequestMock).not.toHaveBeenCalled();
  });

  it('creates a payment request for the authenticated user and returns the DTO', async () => {
    const response = await POST(request({ planId: 'premium-monthly' }), routeContext);

    expect(createPaymentRequestMock).toHaveBeenCalledWith('user-1', 'premium-monthly');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: paymentData,
    });
  });

  it('maps invalid subscription plans to a 400 validation boundary', async () => {
    createPaymentRequestMock.mockRejectedValueOnce(new Error('Invalid subscription plan'));

    const response = await POST(request({ planId: 'unknown-plan' }), routeContext);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid plan ID' },
    });
  });

  it('maps unexpected service failures to 500 with the error message', async () => {
    createPaymentRequestMock.mockRejectedValueOnce(new Error('payos unavailable'));

    const response = await POST(request({ planId: 'premium-monthly' }), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'payos unavailable' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error creating payment request',
    );
  });
});
