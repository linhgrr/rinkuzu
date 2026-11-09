/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminReportViewModel } from '@/features/admin/reports/types/admin-reports-view-model';

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
  fetchReports: vi.fn(),
  hideQuiz: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
  useLocale: () => 'en',
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/reports',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/admin/components/AdminPageShell', () => ({
  AdminPageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/features/admin/reports/components/ReportedQuestionEditor', () => ({
  ReportedQuestionEditor: () => null,
}));
vi.mock('@/features/admin/reports/api/admin-reports-api', () => ({
  fetchAdminReportViewModels: (...args: unknown[]) => mocks.fetchReports(...args),
  hideAdminReportedQuiz: (...args: unknown[]) => mocks.hideQuiz(...args),
  deleteAdminReport: vi.fn(),
  updateAdminReportStatus: vi.fn(),
}));

import { AdminReportsPageClient } from '@/features/admin/reports/components/AdminReportsPageClient';

function fakeReport(overrides: Partial<AdminReportViewModel>): AdminReportViewModel {
  return {
    id: 'report-1',
    quizId: 'quiz-1',
    quizTitle: 'Biology 10',
    quizSlug: 'biology-10',
    reporterEmail: 'reader@example.com',
    reporterName: 'Reader',
    content: '',
    status: 'pending',
    createdAt: '2026-11-09T00:00:00.000Z',
    createdAtLabel: '09/11/2026',
    updatedAt: '2026-11-09T00:00:00.000Z',
    updatedAtLabel: '09/11/2026',
    adminNotesInput: '',
    ...overrides,
  };
}

const copyrightReport = fakeReport({
  id: 'report-copyright',
  reason: 'copyright',
  source: 'quiz_page',
  content: 'Copied from a textbook',
});
const questionReport = fakeReport({
  id: 'report-question',
  quizTitle: 'Chemistry 10',
  content: 'Answer B is wrong',
  questionId: 'q-1',
  questionSnapshot: { id: 'q-1', index: 2, question: 'What is H2O?', options: [], type: 'single' },
});

describe('AdminReportsPageClient reasons and hide (RIN-1344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    mocks.fetchReports.mockResolvedValue({
      reports: [copyrightReport, questionReport],
      pendingIndexHoldCount: 4,
    });
    mocks.hideQuiz.mockResolvedValue(undefined);
  });

  it('shows the pending copyright/personal-data count in the header', async () => {
    render(<AdminReportsPageClient />);
    expect(await screen.findByText('4 pending copyright / personal-data')).toBeInTheDocument();
  });

  it('shows reason and source, and Hide quiz only on quiz-level reports', async () => {
    render(<AdminReportsPageClient />);
    const quizCard = (await screen.findByRole('heading', { name: 'Biology 10' })).closest(
      'div.p-6',
    ) as HTMLElement;
    expect(within(quizCard).getByText('Copyright')).toBeInTheDocument();
    expect(within(quizCard).getByText('Quiz page')).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: 'Hide quiz' })).toBeInTheDocument();

    const questionCard = screen
      .getByRole('heading', { name: 'Chemistry 10' })
      .closest('div.p-6') as HTMLElement;
    expect(within(questionCard).getByText('Question 3')).toBeInTheDocument();
    expect(within(questionCard).queryByRole('button', { name: 'Hide quiz' })).toBeNull();
  });

  it('filters by reason', async () => {
    const user = userEvent.setup();
    render(<AdminReportsPageClient />);
    await screen.findByRole('heading', { name: 'Biology 10' });
    expect(mocks.fetchReports).toHaveBeenLastCalledWith(
      { status: 'all', reason: 'all' },
      expect.any(AbortSignal),
    );

    const reasons = screen.getByRole('group', { name: 'Filter by reason' });
    await user.click(within(reasons).getByRole('button', { name: 'Personal data' }));

    await waitFor(() =>
      expect(mocks.fetchReports).toHaveBeenLastCalledWith(
        { status: 'all', reason: 'personal_data' },
        expect.any(AbortSignal),
      ),
    );
    // The list reloads behind a skeleton, so query the bar again once it is back.
    await screen.findByRole('heading', { name: 'Biology 10' });
    expect(
      within(screen.getByRole('group', { name: 'Filter by reason' })).getByRole('button', {
        name: 'Personal data',
        pressed: true,
      }),
    ).toBeInTheDocument();
  });

  it('hides the quiz after confirmation and reloads the list', async () => {
    const user = userEvent.setup();
    render(<AdminReportsPageClient />);
    await user.click(await screen.findByRole('button', { name: 'Hide quiz' }));

    const dialog = await screen.findByRole('dialog', { name: 'Hide quiz' });
    expect(dialog).toHaveTextContent('Biology 10');
    await user.click(within(dialog).getByRole('button', { name: 'Hide quiz' }));

    await waitFor(() => expect(mocks.hideQuiz).toHaveBeenCalledWith('report-copyright', ''));
    await waitFor(() => expect(mocks.fetchReports).toHaveBeenCalledTimes(2));
  });
});
