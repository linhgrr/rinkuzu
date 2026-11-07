/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import CheckoutClient from './CheckoutClient';

const mocks = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  quote: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  verifyOrder: vi.fn(),
}));

const copy: Record<string, string> = {
  loading: 'Loading checkout…',
  'noPlan.unavailable': 'This plan is not available',
  'noPlan.action': 'Choose a Premium plan',
  'actions.retry': 'Try again',
  'header.title': 'Review and pay',
  'paymentMethod.title': 'Payment method',
  'paymentMethod.bankQr': 'Bank transfer via QR code',
  'paymentMethod.bankQrDescription': 'Available through Vietnamese banking apps.',
  'promo.prompt': 'Have a promo code?',
  'promo.label': 'Promo code',
  'promo.placeholder': 'Enter promo code',
  'promo.apply': 'Apply',
  'terms.prefix': 'I agree to the',
  'terms.service': 'Terms of Service',
  'terms.and': 'and',
  'terms.refund': 'refund terms',
  'terms.oneTime': ', and understand that this is a one-time payment with no automatic renewal.',
  'summary.title': 'Order summary',
  'summary.oneTime': 'One-time payment · No automatic renewal',
  'summary.basePrice': 'Base price',
  'summary.discount': 'Discount',
  'summary.dueToday': 'Due today',
  'summary.updating': 'Updating price…',
  'summary.openingProvider': 'Opening PayOS',
  'summary.provider': 'PayOS will open the QR payment page next.',
};

// One `t` for every render, as next-intl gives: the quote effect depends on it.
vi.mock('next-intl', () => {
  const t = (key: string, values?: Record<string, string | number>) => {
    if (key === 'summary.monthDuration') {
      return `${String(values?.['count'])} month of Premium access`;
    }
    if (key === 'summary.dayDuration') {
      return `${String(values?.['count'])} days of Premium access`;
    }
    if (key === 'summary.pay') {
      return `Continue to PayOS · ${String(values?.['amount'])}`;
    }
    return copy[key] ?? key;
  };
  return { useTranslations: () => t };
});

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock('@/features/billing/api/checkout-api', () => ({
  cancelCheckoutOrder: mocks.cancelOrder,
  createCheckoutOrder: mocks.createOrder,
  getCheckoutOrder: mocks.getOrder,
  requestCheckoutQuote: mocks.quote,
  verifyCheckoutOrder: mocks.verifyOrder,
}));

vi.mock('@/lib/security/trusted-navigation', () => ({
  assertTrustedPayosCheckoutUrl: (url: string) => url,
}));

const quote = {
  token: 'signed-quote',
  quote: {
    baseAmount: 49_000,
    discountAmount: 0,
    finalAmount: 49_000,
    currency: 'VND' as const,
    durationUnit: 'month' as const,
    durationValue: 1,
    expiresAt: Date.now() + 300_000,
  },
  plan: { id: 'premium-monthly', name: 'RinKuzu Plus' },
};

describe('CheckoutClient purchase review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quote.mockResolvedValue(quote);
  });

  afterEach(cleanup);

  it('shows the plan duration, one-time policy, and due-today amount without filler copy', async () => {
    render(<CheckoutClient planId="premium-monthly" orderId={null} hasProviderCallback={false} />);

    expect(await screen.findByRole('heading', { name: 'Review and pay' })).toBeTruthy();
    expect(screen.getByText('RinKuzu Plus')).toBeTruthy();
    expect(screen.getByText('1 month of Premium access')).toBeTruthy();
    expect(screen.getByText('One-time payment · No automatic renewal')).toBeTruthy();
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getAllByText(/49\.000/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Your price is confirmed before a payment is created.')).toBeNull();
    expect(screen.queryByText('Selected')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps promo entry collapsed until requested and exposes linked payment terms', async () => {
    const user = userEvent.setup();
    render(<CheckoutClient planId="premium-monthly" orderId={null} hasProviderCallback={false} />);

    await screen.findByRole('heading', { name: 'Review and pay' });
    expect(screen.queryByLabelText('Promo code')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Have a promo code?' }));
    expect(screen.getByLabelText('Promo code')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'refund terms' }).getAttribute('href')).toBe(
      '/terms#billing-and-refunds',
    );
  });

  it('requires terms acceptance and creates only one order while submission is active', async () => {
    const user = userEvent.setup();
    let resolveOrder: ((value: object) => void) | undefined;
    mocks.createOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        }),
    );
    render(<CheckoutClient planId="premium-monthly" orderId={null} hasProviderCallback={false} />);

    const payButton = await screen.findByRole('button', { name: /Continue to PayOS/ });
    expect((payButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox'));
    expect((payButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(payButton);
    await user.click(payButton);

    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    resolveOrder?.({
      id: 'order-public-id',
      plan: quote.plan,
      currency: 'VND',
      baseAmount: 49_000,
      discountAmount: 0,
      finalAmount: 49_000,
      receivedAmount: 0,
      collectionStatus: 'unpaid',
      attemptCollectionStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      settlementStatus: 'unsettled',
    });
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith('/checkout?order=order-public-id'),
    );
  });

  it('clears the pending pay button when creating the order fails', async () => {
    const user = userEvent.setup();
    mocks.createOrder.mockRejectedValue(new Error('network down'));
    render(<CheckoutClient planId="premium-monthly" orderId={null} hasProviderCallback={false} />);

    await screen.findByRole('button', { name: /Continue to PayOS/ });
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Continue to PayOS/ }));

    const payButton = await screen.findByRole('button', { name: /Continue to PayOS/ });
    expect((payButton as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });
});

// RIN-1015: `/checkout?plan=<unknown>` left an empty summary card, a terms
// checkbox, and a toast that vanished. It now gets a body state with a way out.
describe('CheckoutClient quote failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('shows the choose-a-plan empty state for an unknown plan, without the pay form', async () => {
    const user = userEvent.setup();
    mocks.quote.mockRejectedValue(
      new ApiResponseError({
        message: 'Plan is not available',
        status: 404,
        payload: null,
        code: 'plan_not_found',
      }),
    );
    render(<CheckoutClient planId="nope" orderId={null} hasProviderCallback={false} />);

    expect(await screen.findByRole('heading', { name: 'This plan is not available' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Order summary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Choose a Premium plan' }));
    expect(mocks.push).toHaveBeenCalledWith('/subscription');
  });

  it('offers a retry and a way back to plans when the quote cannot be created', async () => {
    const user = userEvent.setup();
    mocks.quote.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(quote);
    render(<CheckoutClient planId="premium-monthly" orderId={null} hasProviderCallback={false} />);

    expect(await screen.findByRole('heading', { name: 'errors.quote' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose a Premium plan' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Review and pay' })).toBeTruthy();
    expect(mocks.quote).toHaveBeenCalledTimes(2);
  });
});
