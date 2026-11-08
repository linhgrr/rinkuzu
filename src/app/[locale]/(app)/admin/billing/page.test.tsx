import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';

const { useOrdersMock, useDiagnosticsMock } = vi.hoisted(() => ({
  useOrdersMock: vi.fn(),
  useDiagnosticsMock: vi.fn(),
}));

const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/billing',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/admin/billing/hooks/useAdminBillingOrders', () => ({
  useAdminBillingOrders: useOrdersMock,
}));
vi.mock('@/features/admin/billing/hooks/useWebhookDiagnostics', () => ({
  useWebhookDiagnostics: useDiagnosticsMock,
}));
vi.mock('@/features/admin/billing/api/admin-billing-api', () => ({
  revealWebhookPayload: vi.fn(),
  replayWebhook: vi.fn(),
  fetchAdminWebhookDiagnostics: vi.fn(),
  postBillingMutation: vi.fn(),
}));

import AdminBillingPage from './page';
import { ZERO_BILLING_HEALTH } from '@/features/admin/billing/components/BillingHealthTiles';

function orders() {
  return {
    orders: [],
    detail: null,
    detailLoading: false,
    detailError: '',
    health: ZERO_BILLING_HEALTH,
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    bucket: 'attention' as const,
    searchInput: '',
    status: 'ready' as const,
    loadError: null,
    setBucket: vi.fn(),
    setSearchInput: vi.fn(),
    submitSearch: vi.fn(),
    setPage: vi.fn(),
    reload: vi.fn(),
    openDetail: vi.fn(),
    closeDetail: vi.fn(),
    refreshAfterMutation: vi.fn(),
  };
}

function diagnostics() {
  return {
    webhooks: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    verificationClass: '',
    loading: false,
    loadError: null,
    setVerificationClass: vi.fn(),
    setPage: vi.fn(),
    reload: vi.fn(),
  };
}

/**
 * The page was 693 lines of table markup, form state, fetch calls and modal
 * plumbing in one component, and the webhook record it claimed to expose was
 * not on it at all. What is worth pinning after the split is the composition:
 * both halves of one investigation are reachable here, and the expensive second
 * query only runs when someone actually looks at it.
 */
describe('the admin billing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrdersMock.mockReturnValue(orders());
    useDiagnosticsMock.mockReturnValue(diagnostics());
  });

  it('lands on the order queue', () => {
    render(<AdminBillingPage />);

    expect(screen.getByText('Billing orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument();
  });

  it('does not load the webhook record until the tab is opened', () => {
    // A second paginated query on every page load, for a tab most visits never
    // open, is a cost paid by the queue an operator actually came for.
    render(<AdminBillingPage />);

    expect(useDiagnosticsMock).toHaveBeenCalledWith(false);
  });

  it('reaches the webhook record from the same page as the orders', async () => {
    // The claim the docs made and the UI did not honour: an order that took
    // money and granted nothing is explained by what arrived at the webhook
    // door, and that explanation used to live only in the database.
    render(<AdminBillingPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Webhooks' }));

    expect(useDiagnosticsMock).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('No deliveries recorded')).toBeInTheDocument();
    // The order controls are out of the way rather than stacked underneath.
    expect(screen.queryByRole('button', { name: 'Needs attention' })).toBeNull();
  });

  it('goes back to the orders without losing the webhook tab', async () => {
    render(<AdminBillingPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Webhooks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Orders' }));

    expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Webhooks' })).toBeInTheDocument();
  });

  it('replaces the tiles and the table with ErrorState and Retry when the query fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const view = {
      ...orders(),
      loadError: new ApiResponseError({
        message: 'internal detail',
        status: 500,
        payload: null,
        code: 'internal',
      }),
    };
    useOrdersMock.mockReturnValue(view);

    render(<AdminBillingPage />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('errors.api.server')).toBeInTheDocument();
    expect(screen.queryByText('Orders needing attention')).not.toBeInTheDocument();
    expect(screen.queryByText('0 orders')).not.toBeInTheDocument();
    expect(screen.queryByText(/codeLabel|Code:/)).not.toBeInTheDocument();
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'common.retry' }));
    expect(view.reload).toHaveBeenCalledTimes(1);
  });

  it('delegates every bucket to the hook rather than filtering in the view', () => {
    const view = orders();
    useOrdersMock.mockReturnValue(view);

    render(<AdminBillingPage />);

    for (const label of ['Unpaid', 'Paid', 'Refunded / disputed', 'All']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(view.setBucket).not.toHaveBeenCalled();
  });
});
