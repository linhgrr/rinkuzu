/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { addGuestClaim } from '@/features/quiz/lib/guest-claims';
import { QuizResultPageClient } from './QuizResultPageClient';

const { claimMock, fetchPageDataMock, searchParams, router, session, signInMock } = vi.hoisted(
  () => ({
    claimMock: vi.fn(() => Promise.resolve()),
    fetchPageDataMock: vi.fn(),
    signInMock: vi.fn(),
    session: { value: { data: { user: { id: 'u1' } }, status: 'authenticated' } as object },
    searchParams: { value: new URLSearchParams('attemptId=attempt-1') },
    router: { push: () => undefined, back: () => undefined },
  }),
);

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

vi.mock('@/features/quiz/api/guest-claim-api', () => ({
  claimStoredGuestAttempts: () => claimMock(),
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

  it('keeps entry=blog and its post in the save card callbacks (RIN-1242)', async () => {
    searchParams.value = new URLSearchParams(
      'attemptId=attempt-1&score=80&entry=blog&post=on-thi-jlpt',
    );

    render(<QuizResultPageClient />);

    const blogPath = `${RESULT_PATH}&entry=blog&post=on-thi-jlpt`;
    await screen.findByRole('region', { name: 'guestSaveTitle' });
    fireEvent.click(screen.getByRole('button', { name: 'guestSaveWithGoogle' }));
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: `/en${blogPath}` });
    expect(screen.getByRole('link', { name: 'guestSaveSignInEmail' })).toHaveAttribute(
      'href',
      `/login?callbackUrl=${encodeURIComponent(blogPath)}`,
    );
    expect(screen.getByRole('link', { name: 'guestSaveCreateAccount' })).toHaveAttribute(
      'href',
      `/register?callbackUrl=${encodeURIComponent(blogPath)}`,
    );
  });

  it('drops an untracked entry or a malformed post from the save card callbacks', async () => {
    searchParams.value = new URLSearchParams(
      'attemptId=attempt-1&score=80&entry=newsletter&post=Bad%20Slug',
    );

    render(<QuizResultPageClient />);

    await screen.findByRole('region', { name: 'guestSaveTitle' });
    expect(screen.getByRole('link', { name: 'guestSaveCreateAccount' })).toHaveAttribute(
      'href',
      `/register?callbackUrl=${encodeURIComponent(RESULT_PATH)}`,
    );
  });

  it.each([
    [true, 1],
    [false, 0],
  ])(
    'offers "Send to a classmate" only when the quiz is shareable (%s) (RIN-1179)',
    async (shareable, count) => {
      addGuestClaim({
        attemptId: 'attempt-1',
        token: FAKE_TOKEN,
        quizSlug: 'demo',
        takenAt: Date.now(),
      });
      fetchPageDataMock.mockResolvedValueOnce({
        result: {
          ...guestResult,
          totalQuestions: 10,
          quiz: { ...guestResult.quiz, id: 'quiz-1', shareable, questionCount: 40 },
        },
        bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
      });

      render(<QuizResultPageClient />);

      await screen.findByRole('region', { name: 'guestSaveTitle' });
      expect(screen.queryAllByRole('button', { name: 'share' })).toHaveLength(count);
    },
  );

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
  it('titles a quick round and offers Another 10 and the full quiz (RIN-933)', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    fetchPageDataMock.mockResolvedValueOnce({
      result: { ...guestResult, mode: 'quick' },
      bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
    });

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'quickRound.resultTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'quickRound.another' })).toHaveAttribute(
      'href',
      '/quiz/demo?mode=quick',
    );
    expect(screen.getByRole('link', { name: 'quickRound.fullQuiz' })).toHaveAttribute(
      'href',
      '/quiz/demo?mode=full',
    );
    expect(screen.queryByRole('link', { name: 'redo' })).not.toBeInTheDocument();
  });

  it('shows the URL score without the save card when a just-signed-in guest cannot read the attempt yet', async () => {
    // The claim failed (429, offline), so the token is kept and the member read 404s.
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
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
    expect(screen.queryByRole('region', { name: 'guestSaveTitle' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'redo' })).toHaveAttribute('href', '/quiz/demo');
    expect(
      screen.queryByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).not.toBeInTheDocument();
  });

  it('reads a just-signed-in learner result only after the guest claim settles (RIN-921)', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    let settleClaim: () => void = () => undefined;
    claimMock.mockImplementationOnce(() => new Promise<void>((resolve) => (settleClaim = resolve)));
    fetchPageDataMock.mockResolvedValueOnce({
      result: guestResult,
      bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
    });

    render(<QuizResultPageClient />);

    await waitFor(() => expect(claimMock).toHaveBeenCalledTimes(1));
    expect(fetchPageDataMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).not.toBeInTheDocument();

    settleClaim();

    expect(await screen.findByRole('link', { name: 'redo' })).toBeInTheDocument();
    expect(fetchPageDataMock).toHaveBeenCalledWith('attempt-1', 'en', undefined);
  });

  it('never claims for a guest reader', async () => {
    session.value = { data: null, status: 'unauthenticated' };
    fetchPageDataMock.mockResolvedValueOnce({
      result: guestResult,
      bookmarks: { bookmarkedQuestions: new Set(), bookmarkIdsByQuestion: {} },
    });
    addGuestClaim({
      attemptId: 'attempt-1',
      token: FAKE_TOKEN,
      quizSlug: 'demo',
      takenAt: Date.now(),
    });

    render(<QuizResultPageClient />);

    expect(await screen.findByRole('link', { name: 'redo' })).toBeInTheDocument();
    expect(claimMock).not.toHaveBeenCalled();
  });

  // RIN-1310: signed in from another browser (no guest token here) before the attempt
  // was attached to the account: keep the score from the link, not a 404.
  it('shows the URL score to a signed-in reader whose browser holds no guest token', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Not found', status: 404, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(await screen.findByText('guestReviewUnavailable')).toHaveAttribute('role', 'status');
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'guestSaveTitle' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the not-found state for a signed-in reader when the link carries no score', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    searchParams.value = new URLSearchParams('attemptId=attempt-1');
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Not found', status: 404, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).toBeInTheDocument();
  });

  it('keeps the retryable error for a signed-in reader whose read fails on the server', async () => {
    session.value = { data: { user: { id: 'u1' } }, status: 'authenticated' };
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Server error', status: 500, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(await screen.findByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });
});
