/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpgradePaywallModal } from './UpgradePaywallModal';

const { fetchSubscriptionPageMock, routerPushMock } = vi.hoisted(() => ({
  fetchSubscriptionPageMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    `${namespace}:${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('@/features/subscription/api/subscription-page-api', () => ({
  fetchSubscriptionPageViewModel: fetchSubscriptionPageMock,
}));

vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen, title }: { children: ReactNode; isOpen: boolean; title: string }) =>
    isOpen ? <section aria-label={title}>{children}</section> : null,
}));

describe('UpgradePaywallModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows Free beside every live paid offer and derives the best monthly value', async () => {
    const user = userEvent.setup();
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'eco-plus-monthly',
          name: 'Eco Plus 1M',
          price: 39_000,
          priceLabel: '39.000 ₫',
          calculatedMonths: 1,
        },
        {
          id: 'eco-plus-six-months',
          name: 'Eco Plus 6M',
          price: 100_000,
          priceLabel: '100.000 ₫',
          calculatedMonths: 6,
        },
      ],
      currentSubscription: null,
      isPremium: false,
    });

    render(<UpgradePaywallModal isOpen kind="quota" onClose={vi.fn()} />);

    expect(await screen.findByText('Eco Plus 1M')).toBeTruthy();
    expect(screen.getByText('Eco Plus 6M')).toBeTruthy();
    expect(screen.getByText('pricing:free.name')).toBeTruthy();
    expect(screen.getByText('premium:paywall.bestValue')).toBeTruthy();
    // RIN-1015: localised duration, not the catalogue's English "6 Months".
    expect(screen.getByText('pricing:planDuration:{"months":1}')).toBeTruthy();
    expect(screen.getByText('pricing:planDuration:{"months":6}')).toBeTruthy();
    expect(screen.getByLabelText('premium:paywall.currentPlan')).toBeTruthy();
    await user.click(
      screen.getByRole('button', {
        name: /premium:paywall\.choosePlan:.*Eco Plus 6M/,
      }),
    );
    expect(routerPushMock).toHaveBeenCalledWith('/checkout?plan=eco-plus-six-months');
  });

  it('does not offer another purchase when Premium became active in another tab', async () => {
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [],
      currentSubscription: { isActive: true },
      isPremium: true,
    });

    render(<UpgradePaywallModal isOpen kind="feature" onClose={vi.fn()} />);

    expect(await screen.findByText('premium:paywall.alreadyPremiumTitle')).toBeTruthy();
    expect(screen.queryByText('premium:paywall.bestValue')).toBeNull();
  });

  it('preserves the suppress-future choice when continuing on the free plan', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [],
      currentSubscription: null,
      isPremium: false,
    });

    render(<UpgradePaywallModal isOpen kind="quota" onClose={onClose} />);

    await screen.findByText('premium:paywall.noPlans');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'premium:paywall.continueFree' }));

    expect(onClose).toHaveBeenCalledWith(true);
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
