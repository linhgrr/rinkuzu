/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enPricing from '../../../../../messages/en/pricing.json';
import viPricing from '../../../../../messages/vi/pricing.json';
import PricingPage from './page';

// RIN-1277: /en tells overseas learners that payment is VND-only before they
// reach PayOS; /vi renders nothing new. Plans are listed cheapest first.

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: string; namespace: 'pricing' }) =>
    createTranslator({
      locale,
      messages: { pricing: locale === 'en' ? enPricing : viPricing },
      namespace: 'pricing',
    }),
}));

vi.mock('@/lib/plan-catalog-factory', () => ({
  createPlanCatalogService: () => ({
    listActive: async () => [
      { id: 'half', name: 'Plus 6M', price: 239_000, duration: 'P6M' },
      { id: 'monthly', name: 'Plus 1M', price: 49_000, duration: 'P1M' },
    ],
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/subscription/components/PricingPaywallTracking', () => ({
  PricingViewTracker: () => null,
  PricingPlanCtaLink: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const renderPage = async (locale: string) =>
  render(await PricingPage({ params: Promise.resolve({ locale }) }));

describe('PricingPage', () => {
  afterEach(cleanup);

  it('shows the Vietnam-only payment note with a support link on /en', async () => {
    await renderPage('en');

    expect(screen.getByText(/Payments are in VND through Vietnamese banking apps/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      '/support',
    );
  });

  it('adds no payment note on /vi', async () => {
    await renderPage('vi');

    expect(screen.queryByText(/VND qua ứng dụng ngân hàng/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Liên hệ hỗ trợ' })).toBeNull();
  });

  it('lists paid plans cheapest first', async () => {
    await renderPage('en');

    const [cheaper, dearer] = ['Plus 1M', 'Plus 6M'].map((name) => screen.getByText(name));
    expect(cheaper?.compareDocumentPosition(dearer as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
