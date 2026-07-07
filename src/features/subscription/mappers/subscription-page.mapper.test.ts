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
            features: ['AI'],
            isLifetime: false,
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
          features: ['AI'],
        },
      ],
      currentSubscription: {
        type: 'premium',
        endDate: '2026-08-02T00:00:00.000Z',
        isLifetime: false,
        endDateLabel: '02/08/2026',
        isActive: true,
        status: 'completed',
      },
      isPremium: true,
    });
  });
});
