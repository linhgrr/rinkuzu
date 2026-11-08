/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileHistory from './ProfileHistory';
import type {
  ProfileHistoryAttemptViewModel,
  ProfileHistoryViewModel,
} from '@/features/profile/types/profile-history-view-model';

const { fetchHistoryMock } = vi.hoisted(() => ({ fetchHistoryMock: vi.fn() }));

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

const SUMMARY = { totalAttempts: 25, averageScore: 67, needsWorkCount: 7 };

function attempt(id: string, score: number): ProfileHistoryAttemptViewModel {
  return {
    id,
    score,
    takenAt: '2026-11-01T00:00:00.000Z',
    takenAtLabel: 'Nov 1, 2026',
    totalQuestions: 10,
    quiz: { title: `Quiz ${id}`, slug: `quiz-${id}` },
  };
}

function viewModel(
  attempts: ProfileHistoryAttemptViewModel[],
  totalItems: number,
  currentPage = 1,
): ProfileHistoryViewModel {
  const totalPages = Math.ceil(totalItems / 10);
  return {
    attempts,
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage: 10,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
    summary: SUMMARY,
  };
}

function requestedParams(callIndex: number): Record<string, string> {
  const params = fetchHistoryMock.mock.calls[callIndex]?.[0] as URLSearchParams;
  return Object.fromEntries(params.entries());
}

function filterGroup() {
  return screen.getByRole('group', { name: 'profile.historyFilterLabel' });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProfileHistory result filter and all-attempts stats (RIN-1204)', () => {
  it('shows the stats from the API summary, not from the current page', async () => {
    fetchHistoryMock.mockResolvedValue(viewModel([attempt('a', 100), attempt('b', 0)], 25));

    render(<ProfileHistory />);

    await screen.findByText('Quiz a');
    // The page mean would be 50%; the summary over all 25 attempts says 67%.
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('profile.historyNeedsWorkCount')).toBeTruthy();
    expect(requestedParams(0)).toEqual({ page: '1', limit: '10' });
  });

  it('refetches page 1 with the result filter and keeps the stats', async () => {
    fetchHistoryMock
      .mockResolvedValueOnce(viewModel([attempt('a', 90)], 25, 1))
      .mockResolvedValueOnce(viewModel([attempt('b', 70)], 25, 2))
      .mockResolvedValueOnce(viewModel([attempt('c', 20)], 7, 1));

    render(<ProfileHistory />);
    await screen.findByText('Quiz a');

    fireEvent.click(screen.getByRole('button', { name: /2/ }));
    await screen.findByText('Quiz b');
    expect(requestedParams(1)).toEqual({ page: '2', limit: '10' });

    fireEvent.click(
      within(filterGroup()).getByRole('button', { name: 'profile.historyFilterNeedsWork' }),
    );

    await screen.findByText('Quiz c');
    expect(requestedParams(2)).toEqual({ page: '1', limit: '10', result: 'needs_work' });
    expect(
      within(filterGroup())
        .getByRole('button', { name: 'profile.historyFilterNeedsWork' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // Stats describe the whole history, so they do not follow the filter.
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
  });

  it('shows the filtered-empty state and "Show all" goes back to every attempt', async () => {
    fetchHistoryMock
      .mockResolvedValueOnce(viewModel([attempt('a', 90)], 1))
      .mockResolvedValueOnce(viewModel([], 0))
      .mockResolvedValueOnce(viewModel([attempt('a', 90)], 1));

    render(<ProfileHistory />);
    await screen.findByText('Quiz a');

    fireEvent.click(
      within(filterGroup()).getByRole('button', { name: 'profile.historyFilterNeedsWork' }),
    );

    await screen.findByText('profile.historyEmptyNeedsWork');
    expect(screen.queryByText('profile.noHistory')).toBeNull();
    expect(filterGroup()).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'profile.historyShowAll' }));

    await screen.findByText('Quiz a');
    expect(requestedParams(2)).toEqual({ page: '1', limit: '10' });
    expect(
      within(filterGroup())
        .getByRole('button', { name: 'profile.historyFilterAll' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('uses the passed copy when the Passed filter is empty', async () => {
    fetchHistoryMock
      .mockResolvedValueOnce(viewModel([attempt('c', 10)], 1))
      .mockResolvedValueOnce(viewModel([], 0));

    render(<ProfileHistory />);
    await screen.findByText('Quiz c');

    fireEvent.click(
      within(filterGroup()).getByRole('button', { name: 'profile.historyFilterPassed' }),
    );

    await screen.findByText('profile.historyEmptyPassed');
    expect(requestedParams(1)).toEqual({ page: '1', limit: '10', result: 'passed' });
  });

  it('keeps the last good list and stats when a filter fetch fails', async () => {
    fetchHistoryMock
      .mockResolvedValueOnce(viewModel([attempt('a', 90)], 25))
      .mockRejectedValueOnce(new Error('network down'));

    render(<ProfileHistory />);
    await screen.findByText('Quiz a');

    fireEvent.click(
      within(filterGroup()).getByRole('button', { name: 'profile.historyFilterPassed' }),
    );

    await screen.findByRole('button', { name: /retry/i });
    expect(screen.getByText('Quiz a')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.queryByText('profile.historyEmptyPassed')).toBeNull();
  });

  it('shows no stats and no filter for a learner with no attempts', async () => {
    fetchHistoryMock.mockResolvedValue({
      ...viewModel([], 0),
      summary: { totalAttempts: 0, averageScore: null, needsWorkCount: 0 },
    });

    render(<ProfileHistory />);

    await screen.findByText('profile.noHistory');
    expect(screen.queryByRole('group', { name: 'profile.historyFilterLabel' })).toBeNull();
    expect(screen.queryByText('profile.totalAttempts')).toBeNull();
  });

  it('uses the shared pass mark for the "Pass" / "Needs Work" badge', async () => {
    fetchHistoryMock.mockResolvedValue(viewModel([attempt('p', 60), attempt('n', 59)], 2));

    render(<ProfileHistory />);

    await screen.findByText('Quiz p');
    expect(screen.getByText('profile.pass')).toBeTruthy();
    expect(screen.getByText('profile.needsWork')).toBeTruthy();
  });
});
