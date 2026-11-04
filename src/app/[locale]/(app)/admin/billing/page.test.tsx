import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useOrdersMock, useDiagnosticsMock } = vi.hoisted(() => ({
  useOrdersMock: vi.fn(),
  useDiagnosticsMock: vi.fn(),
}));

const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({ useTranslations: () => translate }));
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
    error: '',
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
    error: '',
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

  it('surfaces a failed order query rather than an empty table', () => {
    useOrdersMock.mockReturnValue({ ...orders(), error: 'Failed to load billing orders' });

    render(<AdminBillingPage />);

    expect(screen.getByText('Failed to load billing orders')).toBeInTheDocument();
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
