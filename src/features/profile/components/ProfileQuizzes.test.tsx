/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProfileQuizLibraryPageQuery,
  ProfileQuizLibraryViewModel,
  ProfileQuizViewModel,
} from '@/features/profile/types/profile-quiz-view-model';
import ProfileQuizzes from './ProfileQuizzes';

const { fetchPageMock, translate } = vi.hoisted(() => ({
  fetchPageMock: vi.fn(),
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => translate,
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/my-quizzes',
}));

vi.mock('next/image', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/dashboard/components/QuizUploadDropzone', () => ({
  QuizUploadDropzone: () => null,
}));
vi.mock('@/features/folders/components/FoldersView', () => ({ FoldersView: () => null }));
vi.mock('@/components/ui/NavigationTabBar', () => ({ NavigationTabBar: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('@/features/quiz/api/quiz-api', () => ({ deleteQuizById: vi.fn() }));
vi.mock('@/features/profile/api/premium-submissions-api', () => ({
  fetchMyPremiumSubmissions: vi.fn(async () => []),
}));
vi.mock('@/features/quiz/components/QuizCard', () => ({
  QuizCard: ({ quiz }: { quiz: { title: string } }) => <article>{quiz.title}</article>,
  QuizCardSkeleton: () => <div data-testid="quiz-card-skeleton" />,
}));
vi.mock('@/features/profile/api/profile-quizzes-api', () => ({
  fetchProfileQuizLibraryPage: fetchPageMock,
}));

const counts = { all: 37, inProgress: 5, complete: 32 };

function quiz(title: string, index = 0): ProfileQuizViewModel {
  const date = new Date(Date.UTC(2026, 9, 28 - (index % 20))).toISOString();
  return {
    id: `quiz-${title}`,
    title,
    slug: title.toLowerCase().replaceAll(' ', '-'),
    author: null,
    visibility: 'personal',
    questionCount: 10,
    ownedByMe: false,
    createdAt: date,
    updatedAt: date,
    libraryStatus: 'in_progress',
    displayDate: date,
  };
}

function page(titles: string[], hasMore = false): ProfileQuizLibraryViewModel {
  return { quizzes: titles.map((title, index) => quiz(title, index)), counts, hasMore };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function lastQuery(): ProfileQuizLibraryPageQuery {
  return fetchPageMock.mock.calls.at(-1)?.[0] as ProfileQuizLibraryPageQuery;
}

const searchBox = () => screen.getByRole('searchbox', { name: 'searchMyQuizzes' });

beforeEach(() => {
  fetchPageMock.mockResolvedValue(page(['Algebra', 'Biology']));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  fetchPageMock.mockReset();
});

describe('ProfileQuizzes server search and Load more (RIN-1206)', () => {
  it('loads the first page from the server and labels the segments with the library counts', async () => {
    render(<ProfileQuizzes />);

    expect(await screen.findByText('Algebra')).toBeTruthy();
    expect(fetchPageMock).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toEqual({ page: 1, status: 'all', q: '' });
    const segments = screen.getByRole('group', { name: 'myQuizzes' });
    expect(
      within(segments).getByRole('button', { name: 'filterAllCount:{"count":37}' }),
    ).toBeTruthy();
    expect(
      within(segments).getByRole('button', { name: 'filterInProgressCount:{"count":5}' }),
    ).toBeTruthy();
    expect(
      within(segments).getByRole('button', { name: 'filterCompleteCount:{"count":32}' }),
    ).toBeTruthy();
  });

  it('sends a status filter to the server and resets to page 1', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');

    await user.click(screen.getByRole('button', { name: 'filterCompleteCount:{"count":32}' }));

    await waitFor(() => expect(lastQuery()).toEqual({ page: 1, status: 'complete', q: '' }));
  });

  it('debounces the search: one request with the final text, not one per keystroke', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');

    await user.type(searchBox(), 'alg');
    expect(fetchPageMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(lastQuery()).toEqual({ page: 1, status: 'all', q: 'alg' }));
    expect(fetchPageMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the segment counts while a search is loading', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');
    const pending = deferred<ProfileQuizLibraryViewModel>();
    fetchPageMock.mockReturnValueOnce(pending.promise);

    await user.type(searchBox(), 'bio');
    await waitFor(() => expect(lastQuery().q).toBe('bio'));

    expect(screen.getByRole('button', { name: 'filterAllCount:{"count":37}' })).toBeTruthy();
    const list = screen.getByText('Algebra').closest('[aria-busy]') as HTMLElement;
    expect(list.getAttribute('aria-busy')).toBe('true');
    expect(within(list).getByText('Algebra')).toBeTruthy();

    pending.resolve(page(['Biology']));
    await waitFor(() => expect(screen.queryByText('Algebra')).toBeNull());
    expect(screen.getByRole('button', { name: 'filterAllCount:{"count":37}' })).toBeTruthy();
  });

  it('drops a stale search response that arrives after a newer one', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');
    const slow = deferred<ProfileQuizLibraryViewModel>();
    fetchPageMock.mockReturnValueOnce(slow.promise);

    await user.type(searchBox(), 'al');
    await waitFor(() => expect(lastQuery().q).toBe('al'));
    fetchPageMock.mockResolvedValueOnce(page(['Algebra II']));
    await user.type(searchBox(), 'gebra');
    await screen.findByText('Algebra II');

    slow.resolve(page(['Alchemy']));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Alchemy')).toBeNull();
    expect(screen.getByText('Algebra II')).toBeTruthy();
  });

  it('appends the next page on Load more and keeps focus on the button', async () => {
    const user = userEvent.setup();
    const firstTitles = Array.from({ length: 24 }, (_, index) => `Quiz ${index + 1}`);
    fetchPageMock.mockResolvedValueOnce(page(firstTitles, true));
    render(<ProfileQuizzes />);
    await screen.findByText('Quiz 24');
    fetchPageMock.mockResolvedValueOnce(page(['Quiz 25'], true));

    const loadMore = screen.getByRole('button', { name: 'loadMore' });
    await user.click(loadMore);

    expect(await screen.findByText('Quiz 25')).toBeTruthy();
    expect(screen.getByText('Quiz 1')).toBeTruthy();
    expect(lastQuery()).toEqual({ page: 2, status: 'all', q: '' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'loadMore' })),
    );
  });

  it('hides Load more on the last page', async () => {
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');

    expect(screen.queryByRole('button', { name: 'loadMore' })).toBeNull();
  });

  it('keeps the loaded cards and offers Retry when Load more fails', async () => {
    const user = userEvent.setup();
    fetchPageMock.mockResolvedValueOnce(page(['Algebra', 'Biology'], true));
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');
    fetchPageMock.mockRejectedValueOnce(new Error('network down'));

    await user.click(screen.getByRole('button', { name: 'loadMore' }));

    const alert = await screen.findByRole('alert');
    expect(screen.getByText('Algebra')).toBeTruthy();
    expect(screen.getByText('Biology')).toBeTruthy();

    fetchPageMock.mockResolvedValueOnce(page(['Chemistry']));
    await user.click(within(alert).getByRole('button'));

    expect(await screen.findByText('Chemistry')).toBeTruthy();
    expect(screen.getByText('Algebra')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(lastQuery()).toEqual({ page: 2, status: 'all', q: '' });
  });

  it('shows the empty-search state and its Clear search action', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');
    fetchPageMock.mockResolvedValueOnce(page([]));

    await user.type(searchBox(), 'zzz');

    expect(await screen.findByText('noSearchMatches:{"q":"zzz"}')).toBeTruthy();
    expect(screen.queryByText('noQuizzes')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'clearSearch' }));

    expect((searchBox() as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(lastQuery()).toEqual({ page: 1, status: 'all', q: '' }));
    expect(await screen.findByText('Algebra')).toBeTruthy();
  });

  it('keeps the empty-library state when the library itself is empty', async () => {
    fetchPageMock.mockResolvedValueOnce({
      quizzes: [],
      counts: { all: 0, inProgress: 0, complete: 0 },
      hasMore: false,
    });
    render(<ProfileQuizzes />);

    expect(await screen.findByText('noQuizzes')).toBeTruthy();
  });

  it('clears the search on Escape', async () => {
    const user = userEvent.setup();
    render(<ProfileQuizzes />);
    await screen.findByText('Algebra');

    await user.type(searchBox(), 'alg');
    await waitFor(() => expect(lastQuery().q).toBe('alg'));
    await user.keyboard('{Escape}');

    expect((searchBox() as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(lastQuery().q).toBe(''));
  });
});
