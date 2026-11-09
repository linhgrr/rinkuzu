/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  fetchQuizzes: vi.fn(),
  fetchSubscriptions: vi.fn(),
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
  hideAdminReportedQuiz: vi.fn(),
  updateAdminReportStatus: vi.fn(),
}));
vi.mock('@/features/admin/premium-submissions/api/premium-submissions-api', () => ({
  fetchPremiumSubmissions: (...args: unknown[]) => mocks.fetchPremium(...args),
  fetchPremiumSourceUrl: vi.fn(),
  decidePremiumSubmission: vi.fn(),
  startPremiumReview: vi.fn(),
}));

// The topic panel (RIN-1248) loads with the page; its own tests live beside it.
vi.mock('@/features/admin/quizzes/api/admin-quiz-topics-api', () => ({
  fetchAdminQuizTopics: () => Promise.resolve([]),
}));
vi.mock('@/features/admin/quizzes/components/AdminQuizTopicsPanel', () => ({
  AdminQuizTopicsPanel: () => null,
}));
vi.mock('@/features/quiz/components/QuizPreviewModal', () => ({ QuizPreviewModal: () => null }));
vi.mock('@/features/admin/quizzes/api/admin-quizzes-api', () => ({
  fetchAdminQuizListViewModel: (...args: unknown[]) => mocks.fetchQuizzes(...args),
  fetchAdminQuizDetailViewModel: vi.fn(),
  deleteAdminQuiz: vi.fn(),
  // The starter panel (RIN-1183) loads with the page; its own tests live beside it.
  fetchAdminStarterQuizzes: () => Promise.resolve([]),
  markStarterQuiz: vi.fn(),
  updateStarterQuiz: vi.fn(),
  unmarkStarterQuiz: vi.fn(),
  setAdminQuizVisibility: vi.fn(),
}));
vi.mock('@/features/admin/subscriptions/api/admin-subscriptions-api', () => ({
  fetchAdminSubscriptionsViewModel: (...args: unknown[]) => mocks.fetchSubscriptions(...args),
  revokeAdminSubscription: vi.fn(),
}));

import { AdminQuizzesPageClient } from '@/features/admin/quizzes/components/AdminQuizzesPageClient';
import { AdminSubscriptionsPageClient } from '@/features/admin/subscriptions/components/AdminSubscriptionsPageClient';
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

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const emptyPagination = { page: 1, limit: 12, total: 0, totalPages: 0 };

/**
 * Retry keeps ErrorState up with a pending button until the refetch settles: no skeleton
 * flash, no stat cards in between (RIN-1166).
 */
async function expectPendingRetry(
  user: ReturnType<typeof userEvent.setup>,
  absentWhilePending: string,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'common.retry' }));

  const alert = screen.getByRole('alert');
  expect(alert).toHaveAttribute('aria-busy', 'true');
  expect(within(alert).getByRole('button', { name: 'common.retry' })).toBeDisabled();
  expect(screen.queryByLabelText(/^Loading/)).not.toBeInTheDocument();
  expect(screen.queryByText(absentWhilePending)).not.toBeInTheDocument();
}

describe('admin list Retry stays pending until the refetch settles (RIN-1166)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('quizzes: no filters in the error state, pending Retry, then the list', async () => {
    const user = userEvent.setup();
    const reload = deferred<unknown>();
    mocks.fetchQuizzes.mockRejectedValueOnce(serverError).mockReturnValueOnce(reload.promise);
    renderFresh(<AdminQuizzesPageClient />);

    expectLoadError(await screen.findByRole('alert'));
    expect(screen.queryByPlaceholderText('searchQuizzes')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await expectPendingRetry(user, 'totalQuizzes');

    reload.resolve({
      quizzes: [],
      pagination: { ...emptyPagination, hasNextPage: false, hasPrevPage: false },
    });

    expect(await screen.findByText('noQuizzesFound')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('searchQuizzes')).toBeInTheDocument();
  });

  it('quizzes: a Retry that fails again keeps ErrorState and re-enables Retry', async () => {
    const user = userEvent.setup();
    mocks.fetchQuizzes.mockRejectedValue(serverError);
    renderFresh(<AdminQuizzesPageClient />);

    await user.click(await screen.findByRole('button', { name: 'common.retry' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'common.retry' })).toBeEnabled());
    expect(screen.getByRole('alert')).not.toHaveAttribute('aria-busy');
    expect(mocks.fetchQuizzes).toHaveBeenCalledTimes(2);
  });

  it('subscriptions: pending Retry, then the table', async () => {
    const user = userEvent.setup();
    const reload = deferred<unknown>();
    mocks.fetchSubscriptions.mockRejectedValueOnce(serverError).mockReturnValueOnce(reload.promise);
    renderFresh(<AdminSubscriptionsPageClient />);

    expectLoadError(await screen.findByRole('alert'));

    await expectPendingRetry(user, 'noSubscriptionsFound');

    reload.resolve({ subscriptions: [], pagination: { ...emptyPagination, limit: 10 } });

    expect(await screen.findByText('noSubscriptionsFound')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports: pending Retry, then the empty state', async () => {
    const user = userEvent.setup();
    const reload = deferred<unknown>();
    mocks.fetchReports.mockRejectedValueOnce(serverError).mockReturnValueOnce(reload.promise);
    renderFresh(<AdminReportsPageClient />);

    expectLoadError(await screen.findByRole('alert'));

    await expectPendingRetry(user, 'noReportsTitle');
    expect(screen.getByRole('heading', { level: 1, name: 'quizReports' })).toBeInTheDocument();

    reload.resolve({ reports: [], pendingIndexHoldCount: 0 });

    expect(await screen.findByText('noReportsTitle')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

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
    mocks.fetchReports
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue({ reports: [], pendingIndexHoldCount: 0 });
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
