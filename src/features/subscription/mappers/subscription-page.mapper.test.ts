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
          plan: { id: 'premium', name: 'Premium' },
          isActive: true,
          endDate: '2026-08-02T00:00:00.000Z',
          status: 'completed',
        },
      },
      'vi',
    );

    expect(result).toEqual({
      plans: [
        {
          id: 'premium',
          name: 'Premium',
          price: 99000,
          priceLabel: '99.000 ₫',
          calculatedMonths: 1,
        },
      ],
      currentSubscription: {
        plan: { id: 'premium', name: 'Premium' },
        endDate: '2026-08-02T00:00:00.000Z',
        endDateLabel: '02/08/2026',
        isActive: true,
        status: 'completed',
      },
      isPremium: true,
    });
  });

  it('preserves required plan identity while omitting optional subscription fields', () => {
    const result = toSubscriptionPageViewModel(
      {
        plans: [],
        meta: { durationFormat: 'ISO8601', supportedDurations: [] },
      },
      {
        isPremium: false,
        subscription: {
          plan: { id: 'plus', name: 'Plus' },
          isActive: false,
        },
      },
      'en',
    );

    expect(result.currentSubscription).toEqual({
      plan: { id: 'plus', name: 'Plus' },
      endDateLabel: '-',
      isActive: false,
    });
  });

  it('formats the plan end date in the active locale, en-US on /en (RIN-1265)', () => {
    const result = toSubscriptionPageViewModel(
      { plans: [], meta: { durationFormat: 'ISO8601', supportedDurations: [] } },
      {
        isPremium: true,
        subscription: {
          plan: { id: 'premium', name: 'Premium' },
          isActive: true,
          endDate: '2026-08-02T00:00:00.000Z',
        },
      },
      'en',
    );

    expect(result.currentSubscription?.endDateLabel).toBe('08/02/2026');
  });
});
