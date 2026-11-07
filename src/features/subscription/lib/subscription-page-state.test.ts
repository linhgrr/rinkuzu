import { describe, expect, it } from 'vitest';
import {
  initialSubscriptionPageState,
  subscriptionPageReducer,
  type SubscriptionPageState,
} from '@/features/subscription/lib/subscription-page-state';

const sampleViewModel = {
  plans: [
    {
      id: 'premium',
      name: 'Premium',
      price: 99000,
      priceLabel: '99.000 ₫',
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
};

describe('subscriptionPageReducer', () => {
  it('starts in loading and never pretends ready before a successful load', () => {
    expect(initialSubscriptionPageState.status).toBe('loading');
    expect(initialSubscriptionPageState.isPremium).toBe(false);
    expect(initialSubscriptionPageState.currentSubscription).toBeNull();
  });

  it('enters an explicit error state on load failure', () => {
    const next = subscriptionPageReducer(initialSubscriptionPageState, { type: 'loadError' });

    expect(next.status).toBe('error');
    expect(next.isPremium).toBe(false);
    expect(next.currentSubscription).toBeNull();
    expect(next.plans).toEqual([]);
  });

  it('applies loadSuccess into ready with plans and subscription snapshot', () => {
    const next = subscriptionPageReducer(initialSubscriptionPageState, {
      type: 'loadSuccess',
      value: sampleViewModel,
    });

    expect(next.status).toBe('ready');
    expect(next.plans).toEqual(sampleViewModel.plans);
    expect(next.currentSubscription).toEqual(sampleViewModel.currentSubscription);
    expect(next.isPremium).toBe(true);
  });

  it('transitions error → loading on retry (loadStart) without inventing free/ready state', () => {
    const errored: SubscriptionPageState = {
      ...initialSubscriptionPageState,
      status: 'error',
    };

    const loading = subscriptionPageReducer(errored, { type: 'loadStart' });
    expect(loading.status).toBe('loading');
    expect(loading.isPremium).toBe(false);
    expect(loading.currentSubscription).toBeNull();

    const recovered = subscriptionPageReducer(loading, {
      type: 'loadSuccess',
      value: sampleViewModel,
    });
    expect(recovered.status).toBe('ready');
    expect(recovered.isPremium).toBe(true);
  });

  it('keeps non-premium expired currentSubscription when load succeeds', () => {
    const next = subscriptionPageReducer(initialSubscriptionPageState, {
      type: 'loadSuccess',
      value: {
        plans: sampleViewModel.plans,
        isPremium: false,
        currentSubscription: {
          plan: { id: 'premium_6months', name: 'Premium 6 months' },
          endDate: '2025-12-28T00:00:00.000Z',
          endDateLabel: '28/12/2025',
          isActive: false,
          status: 'expired',
        },
      },
    });

    expect(next.status).toBe('ready');
    expect(next.isPremium).toBe(false);
    expect(next.currentSubscription).toMatchObject({
      plan: { id: 'premium_6months', name: 'Premium 6 months' },
      isActive: false,
      status: 'expired',
    });
  });
});
