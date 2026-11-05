/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { addGuestClaim } from '@/features/quiz/lib/guest-claims';
import { QuizResultPageClient } from './QuizResultPageClient';

const { fetchPageDataMock, searchParams, router, session, signInMock } = vi.hoisted(() => ({
  fetchPageDataMock: vi.fn(),
  signInMock: vi.fn(),
  session: { value: { data: { user: { id: 'u1' } }, status: 'authenticated' } as object },
  searchParams: { value: new URLSearchParams('attemptId=attempt-1') },
  router: { push: () => undefined, back: () => undefined },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => session.value,
  signIn: (...args: unknown[]) => signInMock(...args),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.value,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/demo/result',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stable identity, like next-intl's memoized `t`.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/lib/routing/useRequiredRouteParam', () => ({
  useRequiredRouteParam: () => 'demo',
}));

vi.mock('@/features/ask-rin-chan/components/AskRinPanel', () => ({ AskRinPanel: () => null }));

vi.mock('@/features/quiz/api/quiz-result-page-api', () => ({
  createQuizResultBookmark: vi.fn(),
  deleteQuizResultBookmark: vi.fn(),
  fetchQuizResultPageData: (...args: unknown[]) => fetchPageDataMock(...args),
}));

describe('QuizResultPageClient load failures (RIN-753)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams('attemptId=attempt-1');
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
  });

  it('shows the page-level server error with a retry that reloads, never the server text', async () => {
    fetchPageDataMock
      .mockRejectedValueOnce(
        new ApiResponseError({ message: 'Mongo exploded at shard 3', status: 500, payload: {} }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mongo exploded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(
      await screen.findByRole('heading', { name: 'errors.api.networkTitle' }),
    ).toBeInTheDocument();
    expect(fetchPageDataMock).toHaveBeenCalledTimes(2);
  });

  it('asks a signed-out visitor to sign in and come back on 401', async () => {
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Unauthorized', status: 401, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.authRequiredTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('treats a link without an attempt id as not found', async () => {
    searchParams.value = new URLSearchParams('');

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(fetchPageDataMock).not.toHaveBeenCalled();
  });
});

const guestResult = {
  id: 'attempt-1',
  score: 80,
  scoreLabel: '80%',
  takenAtLabel: '5 Nov 2026',
  historyStatus: 'available',
  quiz: { title: 'Fake quiz', slug: 'demo', description: '', questions: [] },
};
const RESULT_PATH = '/quiz/demo/result?attemptId=attempt-1&score=80';
const FAKE_TOKEN = 'A'.repeat(43);

describe('QuizResultPageClient signed-out result (RIN-912)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    searchParams.value = new URLSearchParams('attemptId=attempt-1&score=80');
    session.value = { data: null, status: 'unauthenticated' };
  });

  it('reads the attempt with the stored claim token and offers to save it with Google', async () => {
    addGuestClaim({
      attemptId: 'attempt-1',
      token: FAKE_TOKEN,
      quizSlug: 'demo',
      takenAt: Date.now(),
    });
    fetchPageDataMock.mockResolvedValueOnce({
      result: guestResult,
      bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
    });

    render(<QuizResultPageClient />);

    const card = await screen.findByRole('region', { name: 'guestSaveTitle' });
    expect(fetchPageDataMock).toHaveBeenCalledWith('attempt-1', 'en', {
      guestClaimToken: FAKE_TOKEN,
    });
    expect(card).toHaveTextContent('guestSaveBody');
    fireEvent.click(screen.getByRole('button', { name: 'guestSaveWithGoogle' }));
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: `/en${RESULT_PATH}` });
    expect(screen.getByRole('link', { name: 'guestSaveSignInEmail' })).toHaveAttribute(
      'href',
      `/login?callbackUrl=${encodeURIComponent(RESULT_PATH)}`,
    );
    expect(screen.getByRole('link', { name: 'guestSaveCreateAccount' })).toHaveAttribute(
      'href',
      `/register?callbackUrl=${encodeURIComponent(RESULT_PATH)}`,
    );
    // Retry needs no sign-in.
    expect(screen.getByRole('link', { name: 'redo' })).toHaveAttribute('href', '/quiz/demo');
    expect(document.body.innerHTML).not.toContain(FAKE_TOKEN);
  });

  it('shows the score from the URL and an honest note when this device has no token', async () => {
    render(<QuizResultPageClient />);

    expect(await screen.findByText('guestReviewUnavailable')).toHaveAttribute('role', 'status');
    expect(fetchPageDataMock).not.toHaveBeenCalled();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'guestSaveTitle' })).toHaveTextContent(
      'guestSaveScoreOnlyBody',
    );
    expect(screen.getByRole('link', { name: 'redo' })).toHaveAttribute('href', '/quiz/demo');
    expect(screen.queryByRole('heading', { name: /errors\.api/ })).not.toBeInTheDocument();
  });

  it('falls back to the URL score when the token read fails', async () => {
    addGuestClaim({
      attemptId: 'attempt-1',
      token: FAKE_TOKEN,
      quizSlug: 'demo',
      takenAt: Date.now(),
    });
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Not found', status: 404, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(await screen.findByText('guestReviewUnavailable')).toHaveAttribute('role', 'status');
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('shows the not-found state when there is neither a token nor a score', async () => {
    searchParams.value = new URLSearchParams('attemptId=attempt-1');

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'guestSaveTitle' })).not.toBeInTheDocument();
  });

  it('shows no save card to a signed-in learner', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    fetchPageDataMock.mockResolvedValueOnce({
      result: guestResult,
      bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
    });

    render(<QuizResultPageClient />);

    expect(await screen.findByRole('link', { name: 'redo' })).toBeInTheDocument();
    expect(fetchPageDataMock).toHaveBeenCalledWith('attempt-1', 'en', undefined);
    expect(screen.queryByRole('region', { name: 'guestSaveTitle' })).not.toBeInTheDocument();
  });
});
