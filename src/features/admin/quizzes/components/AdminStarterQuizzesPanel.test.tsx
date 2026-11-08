/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import type { AdminQuizListItemViewModel } from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import type { AdminStarterQuizViewModel } from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

const mocks = vi.hoisted(() => ({
  // Keys with their values, so a reason or title inside a message is visible to the test.
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join('|')})` : key,
  fetchList: vi.fn(),
  fetchStarters: vi.fn(),
  markStarter: vi.fn(),
  updateStarter: vi.fn(),
  unmarkStarter: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

// Stable `t`: the page lists the error describer as a load-effect dependency.
vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
  useLocale: () => 'en',
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/quizzes',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('@/features/quiz/components/QuizPreviewModal', () => ({ QuizPreviewModal: () => null }));
vi.mock('@/features/admin/quizzes/api/admin-quizzes-api', () => ({
  fetchAdminQuizListViewModel: (...args: unknown[]) => mocks.fetchList(...args),
  fetchAdminQuizDetailViewModel: vi.fn(),
  deleteAdminQuiz: vi.fn(),
  setAdminQuizVisibility: vi.fn(),
  fetchAdminStarterQuizzes: (...args: unknown[]) => mocks.fetchStarters(...args),
  markStarterQuiz: (...args: unknown[]) => mocks.markStarter(...args),
  updateStarterQuiz: (...args: unknown[]) => mocks.updateStarter(...args),
  unmarkStarterQuiz: (...args: unknown[]) => mocks.unmarkStarter(...args),
}));

import { AdminQuizzesPageClient } from './AdminQuizzesPageClient';

function starter(
  id: string,
  order: number,
  overrides: Partial<AdminStarterQuizViewModel> = {},
): AdminStarterQuizViewModel {
  return {
    id,
    quizId: `quiz-${id}`,
    title: `Fake starter ${id}`,
    questionCount: 8,
    locale: 'vi',
    order,
    quick: false,
    dropReason: null,
    ...overrides,
  };
}

function quiz(overrides: Partial<AdminQuizListItemViewModel> = {}): AdminQuizListItemViewModel {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Fake Community Quiz',
    slug: 'fake-community-quiz',
    author: { id: '507f191e810c19729de860eb', displayName: 'Fake Author' },
    visibility: 'public',
    visibilityLabelKey: 'public',
    questionCount: 3,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function listOf(...quizzes: AdminQuizListItemViewModel[]) {
  return {
    quizzes,
    pagination: {
      page: 1,
      limit: 12,
      total: quizzes.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const serverError = new ApiResponseError({
  message: 'internal detail',
  status: 500,
  payload: null,
  code: 'internal_error',
});

function starterList() {
  return screen.findByRole('list', { name: 'listLabel' });
}

/** The nth element, failing the test when it is missing (no non-null assertions). */
function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index];
  if (!element) throw new Error(`No element at ${index}`);
  return element;
}

function starterTitles(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

describe('AdminQuizzesPageClient starter panel (RIN-1183)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    mocks.fetchList.mockResolvedValue(listOf(quiz()));
  });

  it('lists starters in order with locale, question count and the quick round badge', async () => {
    mocks.fetchStarters.mockResolvedValue([
      starter('a', 1, { quick: true, questionCount: 20 }),
      starter('b', 2, { locale: 'en' }),
    ]);
    render(<AdminQuizzesPageClient />);

    const list = await starterList();
    expect(starterTitles(list)).toEqual(['Fake starter a', 'Fake starter b']);
    const rows = within(list).getAllByRole('listitem');
    const first = nth(rows, 0);
    const second = nth(rows, 1);
    expect(within(first).getByText('quickBadge')).toBeInTheDocument();
    expect(within(first).getByText('questionCount(20)')).toBeInTheDocument();
    expect(within(second).queryByText('quickBadge')).not.toBeInTheDocument();
    expect(within(second).getByRole('combobox')).toHaveValue('en');
    expect(within(first).getByRole('button', { name: 'moveUp(Fake starter a)' })).toBeDisabled();
    expect(within(second).getByRole('button', { name: 'moveDown(Fake starter b)' })).toBeDisabled();
  });

  it('shows ⚠ with the reason in words for a dropped starter', async () => {
    mocks.fetchStarters.mockResolvedValue([
      starter('a', 1),
      starter('b', 2, { title: null, dropReason: 'missing' }),
      starter('c', 3, { dropReason: 'premium' }),
    ]);
    render(<AdminQuizzesPageClient />);

    const rows = within(await starterList()).getAllByRole('listitem');
    const live = nth(rows, 0);
    const missing = nth(rows, 1);
    const premium = nth(rows, 2);
    expect(within(live).queryByText(/droppedLabel/)).not.toBeInTheDocument();
    expect(within(missing).getByRole('heading', { name: 'untitled' })).toBeInTheDocument();
    expect(within(missing).getByText('droppedLabel(dropMissing)')).toBeInTheDocument();
    expect(within(missing).getByText('droppedNote')).toBeInTheDocument();
    expect(within(premium).getByText('droppedLabel(dropPremium)')).toBeInTheDocument();
  });

  it('shows the empty state with how to add a starter', async () => {
    mocks.fetchStarters.mockResolvedValue([]);
    render(<AdminQuizzesPageClient />);

    expect(await screen.findByText('emptyTitle')).toBeInTheDocument();
    expect(screen.getByText('emptyHint')).toBeInTheDocument();
  });

  it('shows ErrorState on a failed load; Retry stays pending until the list arrives', async () => {
    const user = userEvent.setup();
    const reload = deferred<AdminStarterQuizViewModel[]>();
    mocks.fetchStarters.mockRejectedValueOnce(serverError).mockReturnValueOnce(reload.promise);
    render(<AdminQuizzesPageClient />);

    const alert = await screen.findByRole('alert');
    expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'common.retry' }));
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: 'common.retry' }),
    ).toBeDisabled();

    reload.resolve([starter('a', 1)]);

    expect(starterTitles(await starterList())).toEqual(['Fake starter a']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves a starter at once and rolls the order back with a toast when the write fails', async () => {
    const user = userEvent.setup();
    const write = deferred<AdminStarterQuizViewModel[]>();
    mocks.fetchStarters.mockResolvedValue([starter('a', 1), starter('b', 2)]);
    mocks.updateStarter.mockReturnValue(write.promise);
    render(<AdminQuizzesPageClient />);

    const list = await starterList();
    await user.click(within(list).getByRole('button', { name: 'moveUp(Fake starter b)' }));

    expect(mocks.updateStarter).toHaveBeenCalledWith('b', { order: 1 });
    expect(starterTitles(list)).toEqual(['Fake starter b', 'Fake starter a']);

    write.reject(serverError);

    await waitFor(() => expect(starterTitles(list)).toEqual(['Fake starter a', 'Fake starter b']));
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('moveError'));
  });

  it('changes the locale and keeps the list the server returns', async () => {
    const user = userEvent.setup();
    mocks.fetchStarters.mockResolvedValue([starter('a', 1)]);
    mocks.updateStarter.mockResolvedValue([starter('a', 1, { locale: 'en' })]);
    render(<AdminQuizzesPageClient />);

    const list = await starterList();
    await user.selectOptions(within(list).getByRole('combobox'), 'en');

    expect(mocks.updateStarter).toHaveBeenCalledWith('a', { locale: 'en' });
    await waitFor(() => expect(within(list).getByRole('combobox')).toHaveValue('en'));
  });

  it('unmarks only after confirmation', async () => {
    const user = userEvent.setup();
    mocks.fetchStarters.mockResolvedValue([starter('a', 1)]);
    mocks.unmarkStarter.mockResolvedValue([]);
    render(<AdminQuizzesPageClient />);

    await user.click(within(await starterList()).getByRole('button', { name: 'unmark' }));
    expect(mocks.unmarkStarter).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('unmarkMessage(Fake starter a)')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'unmark' }));

    expect(mocks.unmarkStarter).toHaveBeenCalledWith('a');
    expect(await screen.findByText('emptyTitle')).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('unmarked');
  });

  it('disables Mark as starter with the reason for personal, empty and existing starters', async () => {
    mocks.fetchStarters.mockResolvedValue([starter('a', 1, { quizId: 'quiz-starter' })]);
    mocks.fetchList.mockResolvedValue(
      listOf(
        quiz({ id: 'quiz-ok', title: 'Fake ok' }),
        quiz({ id: 'quiz-personal', visibility: 'personal', visibilityLabelKey: 'personal' }),
        quiz({ id: 'quiz-empty', questionCount: 0 }),
        quiz({ id: 'quiz-starter' }),
      ),
    );
    render(<AdminQuizzesPageClient />);

    await starterList();
    const buttons = await screen.findAllByRole('button', { name: 'markAction' });
    expect(buttons.map((button) => button.hasAttribute('disabled'))).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(buttons[1]).toHaveAccessibleDescription('markBlockedNotPublic');
    expect(buttons[2]).toHaveAccessibleDescription('markBlockedEmpty');
    expect(buttons[3]).toHaveAccessibleDescription('markBlockedStarter');
  });

  it('marks a quiz with locale and position, and shows a 422 refusal inline in words', async () => {
    const user = userEvent.setup();
    mocks.fetchStarters.mockResolvedValue([starter('a', 1)]);
    mocks.markStarter
      .mockRejectedValueOnce(
        new ApiResponseError({
          message: 'Quiz cannot be a starter: premium',
          status: 422,
          payload: null,
          code: 'validation_error',
        }),
      )
      .mockResolvedValueOnce([
        starter('new', 1, { title: 'Fake Community Quiz' }),
        starter('a', 2),
      ]);
    render(<AdminQuizzesPageClient />);

    await starterList();
    await user.click(await screen.findByRole('button', { name: 'markAction' }));
    const dialog = await screen.findByRole('dialog');
    const selects = within(dialog).getAllByRole('combobox');
    const locale = nth(selects, 0);
    const position = nth(selects, 1);
    expect(locale).toHaveValue('en');
    expect(position).toHaveValue('2');
    await user.selectOptions(locale, 'vi');
    await user.selectOptions(position, '1');
    await user.click(within(dialog).getByRole('button', { name: 'markConfirm' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('markRefused(dropPremium)');
    expect(mocks.markStarter).toHaveBeenCalledWith({
      quizId: '507f191e810c19729de860ea',
      locale: 'vi',
      order: 1,
    });

    await user.click(within(dialog).getByRole('button', { name: 'markConfirm' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(starterTitles(await starterList())).toEqual(['Fake Community Quiz', 'Fake starter a']);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('marked');
  });
});
