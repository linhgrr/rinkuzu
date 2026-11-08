/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileBookmarks from './ProfileBookmarks';
import ProfileHistory from './ProfileHistory';
import ProfileQuizzes from './ProfileQuizzes';

const { fetchHistoryMock, fetchBookmarksMock, fetchLibraryMock, foldersState } = vi.hoisted(() => ({
  fetchHistoryMock: vi.fn(),
  fetchBookmarksMock: vi.fn(),
  fetchLibraryMock: vi.fn(),
  foldersState: {
    folders: [] as { id: string; name: string; quizCount: number }[],
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/my-quizzes',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/features/profile/api/profile-history-api', () => ({
  fetchProfileHistoryViewModel: fetchHistoryMock,
}));

vi.mock('@/features/profile/api/profile-bookmarks-api', () => ({
  fetchProfileBookmarkListViewModel: fetchBookmarksMock,
  deleteProfileBookmark: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-quizzes-api', () => ({
  fetchProfileQuizLibraryViewModel: fetchLibraryMock,
}));

vi.mock('@/features/profile/api/premium-submissions-api', () => ({
  fetchMyPremiumSubmissions: async () => [],
}));

vi.mock('@/features/dashboard/components/QuizUploadDropzone', () => ({
  QuizUploadDropzone: () => <div data-testid="upload-dropzone" />,
}));

vi.mock('@/features/folders/hooks/useFolders', () => ({
  useFolders: () => ({
    folders: foldersState.folders,
    unfiledCount: 0,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

const emptyPagination = { page: 1, limit: 10, total: 0, totalPages: 0 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  foldersState.folders = [];
});

/** Exactly one h1, and no heading jumps more than one level down (axe heading-order). */
function expectHeadingOutline(h1Text: string) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
  const h1s = headings.filter((heading) => heading.tagName === 'H1');
  expect(h1s).toHaveLength(1);
  expect(h1s[0]?.textContent).toBe(h1Text);
  expect(headings[0]?.tagName).toBe('H1');

  let previous = 1;
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    expect(level, `${heading.tagName} "${heading.textContent}"`).toBeLessThanOrEqual(previous + 1);
    previous = level;
  }
}

function renderBookmarks() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ProfileBookmarks />
    </SWRConfig>,
  );
}

const quiz = {
  id: 'quiz-1',
  title: 'Fake biology quiz',
  slug: 'fake-biology-quiz',
  description: '',
  status: 'published',
  libraryStatus: 'complete',
  questionCount: 4,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ownedByMe: true,
};

// RIN-1200: the visible page title is the page's h1 in every state, so heading
// navigation starts at the top and the h1 never flickers in and out.
describe('profile list pages: one h1, no skipped heading levels (RIN-1200)', () => {
  it('history: h1 while loading, then in the empty state', async () => {
    fetchHistoryMock.mockResolvedValue({ attempts: [], pagination: emptyPagination });
    render(<ProfileHistory />);
    expectHeadingOutline('profile.quizHistory');

    await screen.findByText('profile.noHistory');
    expectHeadingOutline('profile.quizHistory');
  });

  it('history: h1 with a list of attempts', async () => {
    fetchHistoryMock.mockResolvedValue({
      attempts: [
        {
          id: 'attempt-1',
          score: 75,
          quiz: { title: 'Fake chemistry quiz', slug: 'fake-chemistry-quiz' },
          totalQuestions: 4,
          correctAnswers: 3,
          completedAt: '2026-10-01T00:00:00.000Z',
          completedAtLabel: 'Oct 1, 2026',
          timeSpentLabel: '2m',
        },
      ],
      pagination: { ...emptyPagination, total: 1, totalPages: 1 },
    });
    render(<ProfileHistory />);

    await screen.findByText('Fake chemistry quiz');
    expectHeadingOutline('profile.quizHistory');
  });

  it('history: h1 in the error state', async () => {
    fetchHistoryMock.mockRejectedValue(new Error('offline'));
    render(<ProfileHistory />);

    await waitFor(() => expect(fetchHistoryMock).toHaveBeenCalled());
    await screen.findByRole('button', { name: /retry/i });
    expectHeadingOutline('profile.quizHistory');
  });

  it('bookmarks: h1 while loading, then in the empty state', async () => {
    fetchBookmarksMock.mockResolvedValue({ bookmarks: [], pagination: emptyPagination });
    renderBookmarks();
    expectHeadingOutline('profile.bookmarkedQuestions');

    await screen.findByText('profile.noBookmarks');
    expectHeadingOutline('profile.bookmarkedQuestions');
  });

  it('bookmarks: h1 in the error state', async () => {
    fetchBookmarksMock.mockRejectedValue(new Error('offline'));
    renderBookmarks();

    await screen.findByRole('button', { name: /retry/i });
    expectHeadingOutline('profile.bookmarkedQuestions');
  });

  it('my quizzes: h1 while loading, then in the empty state', async () => {
    fetchLibraryMock.mockResolvedValue({ quizzes: [] });
    render(<ProfileQuizzes />);
    expectHeadingOutline('profile.myQuizzes');

    await screen.findByText('profile.noQuizzes');
    expectHeadingOutline('profile.myQuizzes');
  });

  it('my quizzes: month groups sit one level under the h1', async () => {
    fetchLibraryMock.mockResolvedValue({ quizzes: [quiz] });
    render(<ProfileQuizzes />);

    await screen.findByText('Fake biology quiz');
    expectHeadingOutline('profile.myQuizzes');
  });

  it('my quizzes: h1 in the error state', async () => {
    fetchLibraryMock.mockRejectedValue(new Error('offline'));
    render(<ProfileQuizzes />);

    await screen.findByRole('button', { name: /retry/i });
    expectHeadingOutline('profile.myQuizzes');
  });

  it('folders tab: the h1 names the active tab', async () => {
    fetchLibraryMock.mockResolvedValue({ quizzes: [] });
    foldersState.folders = [{ id: 'folder-1', name: 'Fake folder', quizCount: 2 }];
    render(<ProfileQuizzes tab="folders" />);

    await screen.findByText('Fake folder');
    expectHeadingOutline('profile.tabFolders');
  });
});
