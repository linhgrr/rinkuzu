/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SubscriptionPage from '@/app/[locale]/(app)/subscription/page';

const { fetchSubscriptionPageMock, routerPushMock, captureMock } = vi.hoisted(() => ({
  fetchSubscriptionPageMock: vi.fn(),
  routerPushMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: captureMock }));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    `${namespace}:${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
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
    const user = userEvent.setup();
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'premium-monthly',
          name: 'Premium Monthly',
          price: 99000,
          priceLabel: '99.000 ₫',
          calculatedMonths: 1,
        },
      ],
      currentSubscription: null,
      isPremium: false,
    });

    render(<SubscriptionPage />);

    expect(await screen.findByRole('heading', { name: 'pricing:free.name' })).toBeTruthy();
    // RIN-1269: one view per page view; the click below adds the upgrade click.
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('pricing_viewed', {
      locale: 'en',
      plan: null,
      source: 'subscription_page',
    });
    expect(screen.getByRole('heading', { name: 'Premium Monthly' })).toBeTruthy();
    // RIN-1015: localised duration, not the catalogue's English "1 Month".
    expect(screen.getByText('pricing:planDuration:{"months":1}')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'subscription:currentPlan' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'subscription:subscribe' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await user.click(screen.getByRole('button', { name: 'subscription:subscribe' }));
    expect(routerPushMock).toHaveBeenCalledWith('/checkout?plan=premium-monthly');
    expect(captureMock).toHaveBeenLastCalledWith('upgrade_clicked', {
      locale: 'en',
      plan: 'premium-monthly',
      source: 'subscription_page',
    });
    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('pricing:free.features.askRinChan')).toBeTruthy();
    expect(screen.getByText('pricing:premium.features.premiumCatalog')).toBeTruthy();
  });

  // RIN-1277: same order as /pricing and the paywall, cheapest first, and the
  // "popular" badge sits on the cheapest plan as it does on /pricing.
  it('lists paid plans cheapest first whatever order the API returns', async () => {
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'yearly',
          name: 'Plus 12M',
          price: 399000,
          priceLabel: '399.000 ₫',
          calculatedMonths: 12,
        },
        {
          id: 'monthly',
          name: 'Plus 1M',
          price: 49000,
          priceLabel: '49.000 ₫',
          calculatedMonths: 1,
        },
        {
          id: 'half',
          name: 'Plus 6M',
          price: 239000,
          priceLabel: '239.000 ₫',
          calculatedMonths: 6,
        },
      ],
      currentSubscription: null,
      isPremium: false,
    });

    render(<SubscriptionPage />);

    await screen.findByRole('heading', { name: 'Plus 1M' });
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['pricing:free.name', 'Plus 1M', 'Plus 6M', 'Plus 12M']);
    expect(
      screen.getByTestId('plan-card-monthly').textContent?.includes('subscription:popular'),
    ).toBe(true);
  });

  it('offers an extension to an active Premium user instead of blocking the card', async () => {
    fetchSubscriptionPageMock.mockResolvedValue({
      plans: [
        {
          id: 'premium-monthly',
          name: 'Premium Monthly',
          price: 99000,
          priceLabel: '99.000 ₫',
          calculatedMonths: 1,
        },
      ],
      currentSubscription: {
        plan: { id: 'premium', name: 'Premium' },
        endDateLabel: '22/08/2026',
        isActive: true,
        status: 'completed',
      },
      isPremium: true,
    });

    const user = userEvent.setup();
    render(<SubscriptionPage />);

    // The entitlement ledger stacks a renewal onto the live period, so an
    // active subscriber must still be able to buy more time.
    const extend = await screen.findByRole('button', { name: 'subscription:extend' });
    expect((extend as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('subscription:extendNote')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'subscription:freePlan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'subscription:subscribe' })).toBeNull();

    await user.click(extend);
    expect(routerPushMock).toHaveBeenCalledWith('/checkout?plan=premium-monthly');
  });
});
