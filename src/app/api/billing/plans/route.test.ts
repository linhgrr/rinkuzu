import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listActivePlansMock, loggerErrorMock } = vi.hoisted(() => ({
  listActivePlansMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/plan-catalog-factory', () => ({
  createPlanCatalogService: () => ({
    listActive: listActivePlansMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/billing/plans/route';
import { SubscriptionDurationType } from '@/types/subscription';

describe('GET /api/billing/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms monthly plan duration metadata', async () => {
    listActivePlansMock.mockResolvedValue([
      {
        id: 'premium-p1m',
        name: 'Premium',
        price: 39000,
        duration: SubscriptionDurationType.MONTHLY,
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
            calculatedMonths: 1,
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
    listActivePlansMock.mockRejectedValueOnce(new Error('plans down'));

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
