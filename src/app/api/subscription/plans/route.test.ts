import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSubscriptionPlansMock, loggerErrorMock } = vi.hoisted(() => ({
  getSubscriptionPlansMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({
    getSubscriptionPlans: getSubscriptionPlansMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/subscription/plans/route';
import { SubscriptionDurationType } from '@/types/subscription';

describe('GET /api/subscription/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms plan duration metadata for lifetime and timed plans', async () => {
    getSubscriptionPlansMock.mockResolvedValue([
      {
        id: 'premium-p1m',
        name: 'Premium',
        price: 99000,
        duration: SubscriptionDurationType.MONTHLY,
        features: ['AI'],
        isActive: true,
      },
      {
        id: 'lifetime',
        name: 'Lifetime',
        price: 999000,
        duration: SubscriptionDurationType.LIFETIME,
        features: ['AI'],
        isActive: true,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        plans: [
          expect.objectContaining({
            id: 'premium-p1m',
            durationDisplay: '1 Month',
            isLifetime: false,
            calculatedMonths: 1,
          }),
          expect.objectContaining({
            id: 'lifetime',
            durationDisplay: 'Lifetime',
            isLifetime: true,
          }),
        ],
        meta: {
          durationFormat: 'ISO8601',
          supportedDurations: Object.values(SubscriptionDurationType),
        },
      },
    });
  });

  it('logs failures and returns a public error envelope', async () => {
    getSubscriptionPlansMock.mockRejectedValueOnce(new Error('plans down'));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Error fetching subscription plans',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch subscription plans' },
    });
  });
});
