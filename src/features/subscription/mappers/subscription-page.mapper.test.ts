import { describe, expect, it } from 'vitest';
import { toSubscriptionPageViewModel } from '@/features/subscription/mappers/subscription-page.mapper';

describe('toSubscriptionPageViewModel', () => {
  it('maps subscription transport data into display-ready view models', () => {
    const result = toSubscriptionPageViewModel(
      {
        plans: [
          {
            id: 'premium',
            name: 'Premium',
            price: 99000,
            duration: 'P1M',
            durationDisplay: '1 Month',
            calculatedMonths: 1,
          },
        ],
        meta: {
          durationFormat: 'ISO8601',
          supportedDurations: ['P1M'],
        },
      },
      {
        isPremium: true,
        subscription: {
          type: 'premium',
          isActive: true,
          endDate: '2026-08-02T00:00:00.000Z',
          status: 'completed',
        },
      },
    );

    expect(result).toEqual({
      plans: [
        {
          id: 'premium',
          name: 'Premium',
          price: 99000,
          priceLabel: '99.000 ₫',
          durationDisplay: '1 Month',
          calculatedMonths: 1,
        },
      ],
      currentSubscription: {
        type: 'premium',
        endDate: '2026-08-02T00:00:00.000Z',
        endDateLabel: '02/08/2026',
        isActive: true,
        status: 'completed',
      },
      isPremium: true,
    });
  });

  it('omits absent optional current subscription fields', () => {
    const result = toSubscriptionPageViewModel(
      {
        plans: [],
        meta: { durationFormat: 'ISO8601', supportedDurations: [] },
      },
      { isPremium: false, subscription: {} },
    );

    expect(result.currentSubscription).toEqual({
      endDateLabel: '-',
      isActive: false,
    });
  });
});
