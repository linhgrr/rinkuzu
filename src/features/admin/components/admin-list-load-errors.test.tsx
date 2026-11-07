/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import type { AdminPromotion } from '@/features/admin/promotions/api/admin-promotions-api';

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
  fetchPromotions: vi.fn(),
  archivePromotion: vi.fn(),
  fetchReports: vi.fn(),
  fetchPremium: vi.fn(),
}));

// Stable `t`: the pages list the error describer as a load-effect dependency.
vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
  useLocale: () => 'en',
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/admin/promotions/api/admin-promotions-api', () => ({
  fetchAdminPromotions: (...args: unknown[]) => mocks.fetchPromotions(...args),
  archiveAdminPromotion: (...args: unknown[]) => mocks.archivePromotion(...args),
  createAdminPromotion: vi.fn(),
}));
vi.mock('@/features/admin/reports/api/admin-reports-api', () => ({
  fetchAdminReportViewModels: (...args: unknown[]) => mocks.fetchReports(...args),
  deleteAdminReport: vi.fn(),
  updateAdminReportStatus: vi.fn(),
}));
vi.mock('@/features/admin/premium-submissions/api/premium-submissions-api', () => ({
  fetchPremiumSubmissions: (...args: unknown[]) => mocks.fetchPremium(...args),
  fetchPremiumSourceUrl: vi.fn(),
  decidePremiumSubmission: vi.fn(),
  startPremiumReview: vi.fn(),
}));

import { AdminPromotionsPageClient } from '@/features/admin/promotions/components/AdminPromotionsPageClient';
import { AdminReportsPageClient } from '@/features/admin/reports/components/AdminReportsPageClient';
import { PremiumSubmissionsPageClient } from '@/features/admin/premium-submissions/components/PremiumSubmissionsPageClient';

const serverError = new ApiResponseError({
  message: 'internal detail',
  status: 500,
  payload: null,
  code: 'internal',
});

const fakePromotion: AdminPromotion = {
  id: 'promo-1',
  code: 'FAKE10',
  kind: 'percentage',
  percentageOff: 10,
  eligibilityClass: 'public',
  perUserLimit: 1,
  reservedCount: 0,
  redeemedCount: 2,
  overrunCount: 0,
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-12-01T00:00:00.000Z',
  active: true,
};

function renderFresh(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>,
  );
}

/** ErrorState with Retry; the body is the page's own load copy when it has one. */
function expectLoadError(alert: HTMLElement, body = 'errors.api.server'): void {
  expect(within(alert).getByText(body)).toBeInTheDocument();
  expect(within(alert).getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
  expect(screen.queryByText(/codeLabel|Code:/)).not.toBeInTheDocument();
  expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
}

describe('admin lists that used to fail silently (RIN-1159)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // jsdom has no modal dialog; the confirm step renders through one.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('reports: ErrorState instead of the empty state, Retry recovers', async () => {
    const user = userEvent.setup();
    mocks.fetchReports.mockRejectedValueOnce(serverError).mockResolvedValue([]);
    renderFresh(<AdminReportsPageClient />);

    expectLoadError(await screen.findByRole('alert'));
    expect(screen.getByRole('heading', { level: 1, name: 'quizReports' })).toBeInTheDocument();
    expect(screen.queryByText('noReportsTitle')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('noReportsTitle')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.fetchReports).toHaveBeenCalledTimes(2);
  });

  it('premium submissions: ErrorState instead of the empty queue, Retry recovers', async () => {
    const user = userEvent.setup();
    mocks.fetchPremium.mockRejectedValueOnce(serverError).mockResolvedValue({ items: [] });
    renderFresh(<PremiumSubmissionsPageClient />);

    expectLoadError(await screen.findByRole('alert'), 'premiumReviewLoadError');
    expect(screen.queryByText('premiumReviewEmpty')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('premiumReviewEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('promotions: ErrorState instead of a blank list, Retry recovers', async () => {
    const user = userEvent.setup();
    mocks.fetchPromotions.mockRejectedValueOnce(serverError).mockResolvedValue([fakePromotion]);
    renderFresh(<AdminPromotionsPageClient />);

    expectLoadError(await screen.findByRole('alert'), 'loadError');

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('FAKE10')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('promotions: Archive asks first and Cancel keeps the promotion active', async () => {
    const user = userEvent.setup();
    mocks.fetchPromotions.mockResolvedValue([fakePromotion]);
    renderFresh(<AdminPromotionsPageClient />);

    await user.click(await screen.findByRole('button', { name: 'archive' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('archiveConfirmTitle')).toBeInTheDocument();
    expect(within(dialog).getByText('archiveConfirmMessage')).toBeInTheDocument();
    expect(mocks.archivePromotion).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.archivePromotion).not.toHaveBeenCalled();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('promotions: confirming Archive calls the archive API once', async () => {
    const user = userEvent.setup();
    mocks.fetchPromotions.mockResolvedValue([fakePromotion]);
    mocks.archivePromotion.mockResolvedValue({ ...fakePromotion, active: false });
    renderFresh(<AdminPromotionsPageClient />);

    await user.click(await screen.findByRole('button', { name: 'archive' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'archiveConfirm' }));

    expect(mocks.archivePromotion).toHaveBeenCalledTimes(1);
    expect(mocks.archivePromotion).toHaveBeenCalledWith('promo-1');
  });
});
