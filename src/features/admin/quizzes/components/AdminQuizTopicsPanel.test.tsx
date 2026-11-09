/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import type { AdminQuizListItemViewModel } from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import type {
  AdminQuizTopicDetailViewModel,
  AdminQuizTopicQuizViewModel,
  AdminQuizTopicViewModel,
} from '@/features/admin/quizzes/types/admin-quiz-topics-view-model';

const mocks = vi.hoisted(() => ({
  // Keys with their values, so a title or count inside a message is visible to the test.
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join('|')})` : key,
  fetchList: vi.fn(),
  fetchTopics: vi.fn(),
  fetchDetail: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  assignQuiz: vi.fn(),
  reorderQuiz: vi.fn(),
  unassignQuiz: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

// Stable `t`: the page lists the error describer as a load-effect dependency.
vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
  useLocale: () => 'vi',
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
// The starter panel has its own tests; here it would only repeat keys like `listLabel`.
vi.mock('@/features/admin/quizzes/components/AdminStarterQuizzesPanel', () => ({
  AdminStarterQuizzesPanel: () => null,
}));
vi.mock('@/features/admin/quizzes/api/admin-quizzes-api', () => ({
  fetchAdminQuizListViewModel: (...args: unknown[]) => mocks.fetchList(...args),
  fetchAdminQuizDetailViewModel: vi.fn(),
  deleteAdminQuiz: vi.fn(),
  setAdminQuizVisibility: vi.fn(),
  fetchAdminStarterQuizzes: () => Promise.resolve([]),
  markStarterQuiz: vi.fn(),
  updateStarterQuiz: vi.fn(),
  unmarkStarterQuiz: vi.fn(),
}));
vi.mock('@/features/admin/quizzes/api/admin-quiz-topics-api', () => ({
  fetchAdminQuizTopics: (...args: unknown[]) => mocks.fetchTopics(...args),
  fetchAdminQuizTopicDetail: (...args: unknown[]) => mocks.fetchDetail(...args),
  createQuizTopic: (...args: unknown[]) => mocks.createTopic(...args),
  updateQuizTopic: (...args: unknown[]) => mocks.updateTopic(...args),
  assignQuizToTopic: (...args: unknown[]) => mocks.assignQuiz(...args),
  reorderTopicQuiz: (...args: unknown[]) => mocks.reorderQuiz(...args),
  unassignTopicQuiz: (...args: unknown[]) => mocks.unassignQuiz(...args),
}));

import { AdminQuizzesPageClient } from './AdminQuizzesPageClient';

const LONG_INTRO = Array.from({ length: 150 }, (_, index) => `từ${index}`).join(' ');

function topic(
  id: string,
  order: number,
  overrides: Partial<AdminQuizTopicViewModel> = {},
): AdminQuizTopicViewModel {
  return {
    id,
    slug: `fake-topic-${id}`,
    name: `Fake topic ${id}`,
    intro: LONG_INTRO,
    introWords: 150,
    order,
    published: false,
    quizCount: 0,
    ...overrides,
  };
}

function topicQuiz(quizId: string, order: number): AdminQuizTopicQuizViewModel {
  return { quizId, order, title: `Fake quiz ${quizId}`, questionCount: 6, isPublic: true };
}

function detailOf(
  base: AdminQuizTopicViewModel,
  quizzes: AdminQuizTopicQuizViewModel[],
): AdminQuizTopicDetailViewModel {
  return { topic: { ...base, quizCount: quizzes.length }, quizzes };
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

function apiError(status: number, code: string) {
  return new ApiResponseError({ message: 'internal detail', status, payload: null, code });
}

function topicList() {
  return screen.findByRole('list', { name: 'listLabel' });
}

function rowOf(list: HTMLElement, name: string): HTMLElement {
  const heading = within(list).getByRole('heading', { name });
  const row = heading.closest('li');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe('AdminQuizzesPageClient topic panel (RIN-1248)', () => {
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

  it('lists topics with their state and blocks publishing a draft whose intro is too short', async () => {
    mocks.fetchTopics.mockResolvedValue([
      topic('a', 1, { published: true, quizCount: 4 }),
      topic('b', 2, { intro: 'ngắn quá', introWords: 2 }),
    ]);
    render(<AdminQuizzesPageClient />);

    const list = await topicList();
    const published = rowOf(list, 'Fake topic a');
    const draft = rowOf(list, 'Fake topic b');
    expect(within(published).getByText('publishedBadge')).toBeInTheDocument();
    expect(within(published).getByText(/\/vi\/explore\/fake-topic-a/)).toBeInTheDocument();
    expect(within(published).getByRole('button', { name: 'unpublish' })).toBeEnabled();
    expect(within(draft).getByText('draftBadge')).toBeInTheDocument();
    expect(within(draft).getByText('publishNeedsIntro')).toBeInTheDocument();
    expect(within(draft).getByRole('button', { name: 'publish' })).toBeDisabled();
  });

  it('shows the empty state with a create action', async () => {
    mocks.fetchTopics.mockResolvedValue([]);
    render(<AdminQuizzesPageClient />);

    expect(await screen.findByText('emptyTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'create' })).toBeEnabled();
  });

  it('retries a failed load', async () => {
    mocks.fetchTopics.mockRejectedValueOnce(apiError(500, 'internal_error'));
    mocks.fetchTopics.mockResolvedValueOnce([topic('a', 1)]);
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'common.retry' }));
    expect(await topicList()).toBeInTheDocument();
  });

  it('creates a draft topic and closes the dialog', async () => {
    mocks.fetchTopics.mockResolvedValue([]);
    mocks.createTopic.mockResolvedValue([topic('new', 1, { name: 'Kinh tế vi mô' })]);
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    await user.click(await screen.findByRole('button', { name: 'create' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('nameField'), 'Kinh tế vi mô');
    await user.type(within(dialog).getByLabelText(/slugField/), 'Kinh-Te-Vi-Mo');
    await user.type(within(dialog).getByLabelText('introField'), 'Giới thiệu ngắn');
    expect(within(dialog).getByText('introWords(3|120|400)')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'createConfirm' }));

    expect(mocks.createTopic).toHaveBeenCalledWith({
      name: 'Kinh tế vi mô',
      slug: 'kinh-te-vi-mo',
      intro: 'Giới thiệu ngắn',
    });
    expect(await topicList()).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('created');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open and says so when the slug is taken', async () => {
    mocks.fetchTopics.mockResolvedValue([topic('a', 1)]);
    mocks.updateTopic.mockRejectedValue(apiError(409, 'conflict'));
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    const row = rowOf(await topicList(), 'Fake topic a');
    await user.click(within(row).getByRole('button', { name: 'edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('nameField')).toHaveValue('Fake topic a');
    await user.click(within(dialog).getByRole('button', { name: 'saveConfirm' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('slugTaken');
    expect(mocks.updateTopic).toHaveBeenCalledWith('a', {
      name: 'Fake topic a',
      slug: 'fake-topic-a',
      intro: LONG_INTRO,
    });
  });

  it('publishes a topic, and explains a 422 refusal in a toast', async () => {
    mocks.fetchTopics.mockResolvedValue([topic('a', 1), topic('b', 2)]);
    mocks.updateTopic.mockResolvedValueOnce([topic('a', 1, { published: true }), topic('b', 2)]);
    mocks.updateTopic.mockRejectedValueOnce(apiError(422, 'validation_error'));
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    const list = await topicList();
    await user.click(within(rowOf(list, 'Fake topic a')).getByRole('button', { name: 'publish' }));
    expect(mocks.updateTopic).toHaveBeenCalledWith('a', { published: true });
    expect(
      await within(rowOf(list, 'Fake topic a')).findByText('publishedBadge'),
    ).toBeInTheDocument();

    await user.click(within(rowOf(list, 'Fake topic b')).getByRole('button', { name: 'publish' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('publishNeedsIntro'));
    expect(within(rowOf(list, 'Fake topic b')).getByText('draftBadge')).toBeInTheDocument();
  });

  it('shows a topic’s quizzes, reorders them and puts the order back on failure', async () => {
    const base = topic('a', 1, { quizCount: 2 });
    mocks.fetchTopics.mockResolvedValue([base]);
    mocks.fetchDetail.mockResolvedValue(detailOf(base, [topicQuiz('q1', 1), topicQuiz('q2', 2)]));
    mocks.reorderQuiz.mockRejectedValue(apiError(500, 'internal_error'));
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    const row = rowOf(await topicList(), 'Fake topic a');
    const toggle = within(row).getByRole('button', { name: 'showQuizzes(2)' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const quizzes = await within(row).findByRole('list', { name: 'quizListLabel(Fake topic a)' });
    expect(mocks.fetchDetail).toHaveBeenCalledWith('a', expect.any(AbortSignal));
    expect(within(quizzes).getByRole('button', { name: 'moveUp(Fake quiz q1)' })).toBeDisabled();

    await user.click(within(quizzes).getByRole('button', { name: 'moveDown(Fake quiz q1)' }));
    expect(mocks.reorderQuiz).toHaveBeenCalledWith('a', 'q1', 2);
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('moveError')),
    );
    expect(within(quizzes).getAllByRole('listitem')[0]).toHaveTextContent('1. Fake quiz q1');
  });

  it('removes a quiz from the open topic and updates the count', async () => {
    const base = topic('a', 1, { quizCount: 1 });
    mocks.fetchTopics.mockResolvedValue([base]);
    mocks.fetchDetail.mockResolvedValue(detailOf(base, [topicQuiz('q1', 1)]));
    mocks.unassignQuiz.mockResolvedValue(detailOf(base, []));
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    const row = rowOf(await topicList(), 'Fake topic a');
    await user.click(within(row).getByRole('button', { name: 'showQuizzes(1)' }));
    await user.click(await within(row).findByRole('button', { name: 'removeQuiz(Fake quiz q1)' }));

    expect(mocks.unassignQuiz).toHaveBeenCalledWith('a', 'q1');
    expect(await within(row).findByText('noQuizzes')).toBeInTheDocument();
    expect(within(row).getByText(/quizCount\(0\)/)).toBeInTheDocument();
  });

  it('adds a public quiz from its row to the chosen topic and position', async () => {
    const first = topic('a', 1);
    const second = topic('b', 2, { quizCount: 2 });
    mocks.fetchTopics.mockResolvedValue([first, second]);
    mocks.assignQuiz.mockResolvedValue(
      detailOf(second, [
        topicQuiz('507f191e810c19729de860ea', 1),
        topicQuiz('q2', 2),
        topicQuiz('q3', 3),
      ]),
    );
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    await topicList();
    await user.click(screen.getByRole('button', { name: 'assignAction' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('topicField'), 'b');
    await user.selectOptions(within(dialog).getByLabelText('positionField'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'assignConfirm' }));

    expect(mocks.assignQuiz).toHaveBeenCalledWith({
      topicId: 'b',
      quizId: '507f191e810c19729de860ea',
      order: 1,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('assigned(Fake topic b)');
    expect(
      within(rowOf(await topicList(), 'Fake topic b')).getByText(/quizCount\(3\)/),
    ).toBeInTheDocument();
  });

  it('refuses a quiz that already has a topic inline, and private quizzes up front', async () => {
    mocks.fetchTopics.mockResolvedValue([topic('a', 1)]);
    mocks.fetchList.mockResolvedValue(
      listOf(
        quiz(),
        quiz({
          id: '507f191e810c19729de860ec',
          title: 'Fake Private Quiz',
          visibility: 'personal',
          visibilityLabelKey: 'personal',
        }),
      ),
    );
    mocks.assignQuiz.mockRejectedValue(apiError(409, 'conflict'));
    const user = userEvent.setup();
    render(<AdminQuizzesPageClient />);

    await topicList();
    const [publicAction, privateAction] = await screen.findAllByRole('button', {
      name: 'assignAction',
    });
    expect(privateAction).toBeDisabled();
    if (!publicAction) throw new Error('No assign action');
    await user.click(publicAction);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'assignConfirm' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('assignRefusedHasTopic');
    expect(mocks.assignQuiz).toHaveBeenCalledWith({
      topicId: 'a',
      quizId: '507f191e810c19729de860ea',
    });
  });
});
