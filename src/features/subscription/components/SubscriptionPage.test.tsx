/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SubscriptionPage from '@/app/[locale]/(app)/subscription/page';

const { fetchSubscriptionPageMock } = vi.hoisted(() => ({
  fetchSubscriptionPageMock: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`,
}));

vi.mock('@/features/subscription/api/subscription-page-api', () => ({
  createSubscriptionPaymentUrl: vi.fn(),
  fetchSubscriptionPageViewModel: fetchSubscriptionPageMock,
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: () => null,
}));

describe('SubscriptionPage plan comparison', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows Free beside the paid plans and marks Free as the current plan', async () => {
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'premium-monthly',
          name: 'Premium Monthly',
          price: 99000,
          priceLabel: '99.000 ₫',
          durationDisplay: '1 month',
        },
      ],
      currentSubscription: null,
      isPremium: false,
    });

    render(<SubscriptionPage />);

    expect(await screen.findByRole('heading', { name: 'pricing:free.name' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Premium Monthly' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'subscription:currentPlan' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'subscription:subscribe' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(screen.getByText('pricing:free.features.askRinChan')).toBeTruthy();
    expect(screen.getByText('pricing:premium.features.privateQuizzes')).toBeTruthy();
  });

  it('marks the paid card as current for an active Premium user', async () => {
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'premium-monthly',
          name: 'Premium Monthly',
          price: 99000,
          priceLabel: '99.000 ₫',
          durationDisplay: '1 month',
        },
      ],
      currentSubscription: {
        type: 'premium',
        endDateLabel: '22/08/2026',
        isActive: true,
        status: 'completed',
      },
      isPremium: true,
    });

    render(<SubscriptionPage />);

    expect(await screen.findByRole('button', { name: 'subscription:currentPlan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'subscription:freePlan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'subscription:subscribe' })).toBeNull();
  });
});
