/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileBookmarks from './ProfileBookmarks';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkQuizListViewModel,
  ProfileBookmarkViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';

const { fetchBookmarksMock, fetchQuizzesMock, deleteBookmarkMock } = vi.hoisted(() => ({
  fetchBookmarksMock: vi.fn(),
  fetchQuizzesMock: vi.fn(),
  deleteBookmarkMock: vi.fn(),
}));

// Stable translators: a new `t` per render would re-run effects that depend on it.
const translators = new Map<string, (key: string, values?: Record<string, unknown>) => string>();
function translatorFor(namespace?: string) {
  const ns = namespace ?? '';
  let translator = translators.get(ns);
  if (!translator) {
    translator = (key, values) => {
      const base = ns ? `${ns}.${key}` : key;
      return values ? `${base}:${JSON.stringify(values)}` : base;
    };
    translators.set(ns, translator);
  }
  return translator;
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => translatorFor(namespace),
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/bookmarks',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/features/profile/api/profile-bookmarks-api', () => ({
  fetchProfileBookmarkListViewModel: fetchBookmarksMock,
  fetchProfileBookmarkQuizzes: fetchQuizzesMock,
  deleteProfileBookmark: deleteBookmarkMock,
}));

vi.mock('@/features/ask-rin-chan/components/AskRinPanel', () => ({
  AskRinPanel: () => null,
}));

// jsdom has no dialog.showModal: a plain dialog stands in for the confirm modal.
vi.mock('@/components/ui/ConfirmModal', async () => {
  const { Button } = await import('@/components/ui/Button');
  return {
    ConfirmModal: ({
      isOpen,
      confirmText,
      onConfirm,
    }: {
      isOpen: boolean;
      confirmText: string;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <div role="dialog">
          <Button onClick={onConfirm}>{confirmText}</Button>
        </div>
      ) : null,
  };
});

vi.mock('@/components/ui/QuestionContent', () => ({
  QuestionContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

function makeBookmark(id: string, quiz: { slug: string; title: string }): ProfileBookmarkViewModel {
  return {
    id,
    quiz,
    question: {
      text: `Sample question ${id}`,
      options: ['Option A', 'Option B'],
      type: 'single',
      correctIndex: 0,
    },
    questionIndex: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    createdAtLabel: 'Nov 1, 2026',
  };
}

const biology = { slug: 'biology-basics', title: 'Biology basics' };
const history = { slug: 'world-history', title: 'World history' };

function listOf(bookmarks: ProfileBookmarkViewModel[], totalItems = bookmarks.length) {
  return {
    bookmarks,
    pagination: {
      currentPage: 1,
      totalPages: Math.max(1, Math.ceil(totalItems / 10)),
      totalItems,
      itemsPerPage: 10,
      hasNextPage: totalItems > 10,
      hasPrevPage: false,
    },
  } satisfies ProfileBookmarkListViewModel;
}

const quizList: ProfileBookmarkQuizListViewModel = {
  quizzes: [
    { ...biology, count: 8 },
    { ...history, count: 4 },
  ],
  total: 12,
};

function bookmarksFor(url: string): ProfileBookmarkListViewModel {
  if (url.includes(`quizSlug=${history.slug}`)) {
    return listOf([makeBookmark('h1', history), makeBookmark('h2', history)], 4);
  }
  if (url.includes(`quizSlug=${biology.slug}`)) {
    return listOf([makeBookmark('b1', biology)], 8);
  }
  return listOf([makeBookmark('b1', biology), makeBookmark('h1', history)], 12);
}

function renderBookmarks() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ProfileBookmarks />
    </SWRConfig>,
  );
}

function quizSelect() {
  return screen.getByLabelText('profile.bookmarkQuizFilterLabel') as HTMLSelectElement;
}

beforeEach(() => {
  fetchBookmarksMock.mockImplementation(async (url: string) => bookmarksFor(url));
  fetchQuizzesMock.mockResolvedValue(quizList);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProfileBookmarks quiz filter (RIN-1208)', () => {
  it('lists every quiz with its count, most first, after "All quizzes (total)"', async () => {
    renderBookmarks();

    await waitFor(() => expect(quizSelect().disabled).toBe(false));
    const options = within(quizSelect()).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((option) => option.textContent)).toEqual([
      'profile.bookmarkQuizFilterAll:{"count":12}',
      'Biology basics (8)',
      'World history (4)',
    ]);
    expect(options[1]?.title).toBe('Biology basics');
    expect(screen.getByText('profile.bookmarkCount:{"count":12}')).toBeTruthy();
  });

  it('keeps the select disabled until the quiz list arrives', async () => {
    let resolveQuizzes: (value: ProfileBookmarkQuizListViewModel) => void = () => undefined;
    fetchQuizzesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveQuizzes = resolve;
      }),
    );
    renderBookmarks();

    await screen.findByText('Sample question b1');
    expect(quizSelect().disabled).toBe(true);

    resolveQuizzes(quizList);
    await waitFor(() => expect(quizSelect().disabled).toBe(false));
  });

  it('hides the select when there are no bookmarks at all', async () => {
    fetchBookmarksMock.mockResolvedValue(listOf([]));
    fetchQuizzesMock.mockResolvedValue({ quizzes: [], total: 0 });
    renderBookmarks();

    await screen.findByText('profile.noBookmarks');
    await waitFor(() => expect(fetchQuizzesMock).toHaveBeenCalled());
    expect(screen.queryByLabelText('profile.bookmarkQuizFilterLabel')).toBeNull();
  });

  it('sends quizSlug, resets to page 1 and updates the header count', async () => {
    renderBookmarks();
    await waitFor(() => expect(quizSelect().disabled).toBe(false));

    fireEvent.change(quizSelect(), { target: { value: history.slug } });

    await screen.findByText('Sample question h2');
    expect(fetchBookmarksMock).toHaveBeenLastCalledWith(
      `/api/bookmarks?page=1&limit=10&quizSlug=${history.slug}`,
      'en',
    );
    expect(screen.getByText('profile.bookmarkCount:{"count":4}')).toBeTruthy();
  });

  it('resets to page 1 when the filter changes on a later page', async () => {
    fetchBookmarksMock.mockImplementation(async (url: string) =>
      url.includes('quizSlug')
        ? listOf([makeBookmark('b1', biology)], 8)
        : listOf([makeBookmark('b1', biology)], 30),
    );
    renderBookmarks();
    await waitFor(() => expect(quizSelect().disabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(fetchBookmarksMock).toHaveBeenLastCalledWith('/api/bookmarks?page=2&limit=10', 'en'),
    );

    fireEvent.change(quizSelect(), { target: { value: biology.slug } });
    await waitFor(() =>
      expect(fetchBookmarksMock).toHaveBeenLastCalledWith(
        `/api/bookmarks?page=1&limit=10&quizSlug=${biology.slug}`,
        'en',
      ),
    );
  });

  it('refetches the quiz list and falls back to All when the last bookmark of a quiz is removed', async () => {
    renderBookmarks();
    await waitFor(() => expect(quizSelect().disabled).toBe(false));
    fireEvent.change(quizSelect(), { target: { value: biology.slug } });
    await screen.findByText('profile.bookmarkCount:{"count":8}');

    deleteBookmarkMock.mockResolvedValue({ deleted: true });
    fetchQuizzesMock.mockResolvedValue({ quizzes: [{ ...history, count: 4 }], total: 4 });
    fetchBookmarksMock.mockImplementation(async () => listOf([makeBookmark('h1', history)], 4));

    fireEvent.click(screen.getByRole('button', { name: /common\.remove/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.remove' }));

    await waitFor(() => expect(deleteBookmarkMock).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(quizSelect().value).toBe(''));
    expect(fetchQuizzesMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(fetchBookmarksMock).toHaveBeenLastCalledWith('/api/bookmarks?page=1&limit=10', 'en'),
    );
  });

  it('hides the select and shows a retryable error when the quiz list fails, keeping the list', async () => {
    fetchQuizzesMock.mockRejectedValueOnce(new Error('boom'));
    renderBookmarks();

    await screen.findByText('Sample question b1');
    const alert = await screen.findByRole('alert');
    expect(screen.queryByLabelText('profile.bookmarkQuizFilterLabel')).toBeNull();

    fireEvent.click(within(alert).getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(quizSelect().disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a "Show all" empty state when the chosen quiz has no bookmarks left', async () => {
    renderBookmarks();
    await waitFor(() => expect(quizSelect().disabled).toBe(false));

    fetchBookmarksMock.mockImplementation(async (url: string) =>
      url.includes('quizSlug') ? listOf([], 0) : bookmarksFor(url),
    );
    fireEvent.change(quizSelect(), { target: { value: history.slug } });

    await screen.findByText('profile.bookmarkQuizFilterEmpty');
    expect(screen.queryByText('profile.noBookmarks')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'profile.bookmarkQuizFilterShowAll' }));
    await screen.findByText('Sample question b1');
    expect(quizSelect().value).toBe('');
  });
});

describe('ProfileBookmarks "Open quiz" link (RIN-1208)', () => {
  it('links each bookmark to its quiz with the quiz title in the accessible name', async () => {
    renderBookmarks();
    await screen.findByText('Sample question b1');

    const link = screen.getAllByRole('link', { name: /profile\.openQuiz/ })[0];
    expect(link?.getAttribute('href')).toBe(`/quiz/${biology.slug}`);
    expect(link?.textContent).toContain('Biology basics');
  });
});
