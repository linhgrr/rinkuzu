/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileBookmarks from './ProfileBookmarks';
import ProfileHistory from './ProfileHistory';
import { ReviewPageClient } from '@/features/review/components/ReviewPageClient';

const { fetchHistoryMock, fetchBookmarksMock, fetchDueMock } = vi.hoisted(() => ({
  fetchHistoryMock: vi.fn(),
  fetchBookmarksMock: vi.fn(),
  fetchDueMock: vi.fn(),
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
  usePathname: () => '/history',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/features/profile/api/profile-history-api', () => ({
  fetchProfileHistoryViewModel: fetchHistoryMock,
}));

vi.mock('@/features/profile/api/profile-bookmarks-api', () => ({
  fetchProfileBookmarkListViewModel: fetchBookmarksMock,
  fetchProfileBookmarkQuizzes: async () => ({ quizzes: [], total: 0 }),
  deleteProfileBookmark: vi.fn(),
}));

vi.mock('@/features/review/api/review-session-api', () => ({
  fetchDueReviewQuestionViewModels: fetchDueMock,
  submitReviewAnswer: vi.fn(),
}));

const emptyPagination = { page: 1, limit: 10, total: 0, totalPages: 0 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** One CTA per empty state (RIN-691): a single link, no nested button, same label and target. */
async function expectSingleExploreCta(emptyTitle: string) {
  await screen.findByText(emptyTitle);

  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(1);
  expect(links[0]?.getAttribute('href')).toBe('/explore');
  expect(links[0]?.textContent).toBe('common.exploreQuizzes');
  expect(screen.queryAllByRole('button')).toHaveLength(0);
}

describe('empty state CTA (RIN-691)', () => {
  it('history: one "Explore quizzes" link to /explore', async () => {
    fetchHistoryMock.mockResolvedValue({ attempts: [], pagination: emptyPagination });

    render(<ProfileHistory />);

    await expectSingleExploreCta('profile.noHistory');
    expect(screen.getByText('profile.historyEmptyHint')).toBeTruthy();
    // Dates in the list are formatted for the page locale (RIN-690).
    expect(fetchHistoryMock).toHaveBeenCalledWith(expect.any(URLSearchParams), 'en');
  });

  it('bookmarks: one "Explore quizzes" link to /explore', async () => {
    fetchBookmarksMock.mockResolvedValue({ bookmarks: [], pagination: emptyPagination });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ProfileBookmarks />
      </SWRConfig>,
    );

    await expectSingleExploreCta('profile.noBookmarks');
    expect(screen.getByText('profile.bookmarksEmptyHint')).toBeTruthy();
    expect(fetchBookmarksMock).toHaveBeenCalledWith('/api/bookmarks?page=1&limit=10', 'en');
  });

  it('review: one "Explore quizzes" link to /explore', async () => {
    fetchDueMock.mockResolvedValue([]);

    render(<ReviewPageClient />);

    await expectSingleExploreCta('review.noCards');
  });
});
