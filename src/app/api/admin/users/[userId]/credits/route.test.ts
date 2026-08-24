import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, grantAdminCreditsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  grantAdminCreditsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({ grantAdminCredits: grantAdminCreditsMock }),
}));

import { POST } from '@/app/api/admin/users/[userId]/credits/route';

const userId = '507f1f77bcf86cd799439011';
const adminId = '507f1f77bcf86cd799439012';
const idempotencyKey = '0aa7c561-a366-4abf-81ec-fb90e64c237c';

function routeContext(id = userId) {
  return { params: Promise.resolve({ userId: id }) };
}

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/users/${userId}/credits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/users/[userId]/credits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: adminId, email: 'admin@example.com', role: 'admin' },
    });
  });

  it('requires admin access', async () => {
    authMock.mockResolvedValueOnce(null);
    expect(
      (await POST(request({ amount: 5, note: 'Reward', idempotencyKey }), routeContext())).status,
    ).toBe(401);
  });

  it('validates user id, positive integer amount, reason, and idempotency key', async () => {
    expect(
      (await POST(request({ amount: 5, note: 'Reward', idempotencyKey }), routeContext('bad-id')))
        .status,
    ).toBe(400);
    expect(
      (await POST(request({ amount: 0, note: 'x', idempotencyKey: 'bad' }), routeContext())).status,
    ).toBe(400);
    expect(grantAdminCreditsMock).not.toHaveBeenCalled();
  });

  it('delegates the grant with the authenticated admin identity', async () => {
    const result = {
      userId,
      amount: 5,
      balance: 12,
      ledgerEntryId: '507f1f77bcf86cd799439013',
      alreadyApplied: false,
    };
    grantAdminCreditsMock.mockResolvedValue(result);

    const response = await POST(
      request({ amount: 5, note: 'Verified contribution', idempotencyKey }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(grantAdminCreditsMock).toHaveBeenCalledWith({
      userId,
      adminUserId: adminId,
      amount: 5,
      note: 'Verified contribution',
      idempotencyKey,
    });
    await expect(response.json()).resolves.toMatchObject({ success: true, data: result });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('maps domain failures through the Premium error response', async () => {
    const { PremiumQuizError } = await import('@/entities/PremiumQuizError');
    grantAdminCreditsMock.mockRejectedValueOnce(
      new PremiumQuizError('not_found', 'User not found'),
    );
    expect(
      (
        await POST(
          request({ amount: 5, note: 'Verified contribution', idempotencyKey }),
          routeContext(),
        )
      ).status,
    ).toBe(404);
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
