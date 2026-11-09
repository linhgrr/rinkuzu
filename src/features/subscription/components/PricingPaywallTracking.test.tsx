/** @vitest-environment jsdom */

import { StrictMode, type AnchorHTMLAttributes } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePaywallEvent } from '@/lib/analytics/paywall';
import { PricingPlanCtaLink, PricingViewTracker } from './PricingPaywallTracking';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: captureMock }));
vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

describe('pricing page paywall events (RIN-1269)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends pricing_viewed once per page view, even under the strict-mode double effect', () => {
    const { rerender } = render(
      <StrictMode>
        <PricingViewTracker />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <PricingViewTracker />
      </StrictMode>,
    );

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('pricing_viewed', {
      locale: 'en',
      plan: null,
      source: 'pricing_page',
    });
  });

  it('sends upgrade_clicked with the plan id when a plan CTA is clicked', async () => {
    const user = userEvent.setup();
    render(
      <PricingPlanCtaLink href="/subscription" planId="plan_monthly" className="cta">
        Get Premium
      </PricingPlanCtaLink>,
    );
    expect(captureMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: 'Get Premium' }));

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('upgrade_clicked', {
      locale: 'en',
      plan: 'plan_monthly',
      source: 'pricing_page',
    });
  });

  it('passes only locale, plan and source to analytics', () => {
    const extra = {
      locale: 'vi',
      plan: 'plan_yearly',
      source: 'upgrade_modal',
      email: 'learner@example.test',
    } as const;

    capturePaywallEvent('upgrade_clicked', extra);

    expect(captureMock).toHaveBeenCalledWith('upgrade_clicked', {
      locale: 'vi',
      plan: 'plan_yearly',
      source: 'upgrade_modal',
    });
  });
});
