import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, loggerErrorMock, verifyAndActivateSubscriptionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  verifyAndActivateSubscriptionMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    verifyAndActivateSubscription: verifyAndActivateSubscriptionMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/subscription/verify/route';

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/subscription/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({}) };

describe('POST /api/subscription/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    verifyAndActivateSubscriptionMock.mockResolvedValue({
      success: true,
      subscription: { type: 'premium', isActive: true },
    });
  });

  it('requires authentication before verifying a payment', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ orderCode: 123 }), routeContext);

    expect(response.status).toBe(401);
    expect(verifyAndActivateSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid order codes at the request boundary', async () => {
    const invalid = await POST(request({ orderCode: 0 }), routeContext);
    const nonNumeric = await POST(request({ orderCode: 'abc' }), routeContext);

    expect(invalid.status).toBe(400);
    expect(nonNumeric.status).toBe(400);
    expect(verifyAndActivateSubscriptionMock).not.toHaveBeenCalled();
  });

  it('parses string order codes and delegates activation to the service', async () => {
    const response = await POST(request({ orderCode: '456' }), routeContext);

    expect(verifyAndActivateSubscriptionMock).toHaveBeenCalledWith(456, 'user-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        success: true,
        subscription: { type: 'premium', isActive: true },
      },
    });
  });

  it('forwards numeric order codes without string parsing', async () => {
    await POST(request({ orderCode: 789 }), routeContext);

    expect(verifyAndActivateSubscriptionMock).toHaveBeenCalledWith(789, 'user-1');
  });

  it('maps unexpected verification failures to a safe 500', async () => {
    verifyAndActivateSubscriptionMock.mockRejectedValueOnce(new Error('verify failed'));

    const response = await POST(request({ orderCode: 111 }), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'verify failed' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error verifying payment',
    );
  });
});
