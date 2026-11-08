/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { fetchPremiumBatch } from '@/features/quiz/api/premium-quiz-api';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';

const { pushMock, saveAnswerMock, startSessionMock, submitSessionMock, unlockMock } = vi.hoisted(
  () => ({
    pushMock: vi.fn(),
    saveAnswerMock: vi.fn(),
    startSessionMock: vi.fn(),
    submitSessionMock: vi.fn(),
    unlockMock: vi.fn(),
  }),
);

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  usePathname: () => '/quiz/premium-quiz',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// next-intl memoizes `t` per namespace. Returning a fresh function here would
// change the identity of the player's effect dependency on every render, which
// re-runs the session bootstrap and races the assertions below.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/profile/api/credit-wallet-api', () => ({
  CREDIT_WALLET_KEY: '/api/credits',
  fetchCreditWallet: () => Promise.resolve({ wallet: { balance: 3 } }),
}));

vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  fetchPremiumBatch: vi.fn(),
  savePremiumAnswer: (...args: unknown[]) => saveAnswerMock(...args),
  startPremiumSession: (...args: unknown[]) => startSessionMock(...args),
  submitPremiumSession: (...args: unknown[]) => submitSessionMock(...args),
  unlockPremiumQuiz: (...args: unknown[]) => unlockMock(...args),
}));

function renderPlayer() {
  return render(
    <PremiumQuizPlayerClient
      quizId="quiz-1"
      slug="premium-quiz"
      title="Premium quiz"
      questionCount={1}
    />,
  );
}

describe('PremiumQuizPlayerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startSessionMock.mockResolvedValue({
      sessionId: 'session-1',
      quizId: 'quiz-1',
      submissionId: 'submission-1',
      title: 'Premium quiz',
      totalQuestions: 1,
      batchIndex: 0,
      startIndex: 0,
      questions: [
        {
          id: 'question-1',
          question: 'Premium question?',
          options: ['No', 'Yes'],
          type: 'single',
        },
      ],
      watermark: 'USER · SESSION · TIME',
      idleExpiresAt: '2026-08-24T12:00:00.000Z',
      absoluteExpiresAt: '2026-08-25T10:00:00.000Z',
      currentQuestionIndex: 0,
      answers: [null],
    });
    saveAnswerMock.mockResolvedValue({ saved: true });
    unlockMock.mockResolvedValue({ granted: true, alreadyGranted: false, balance: 0 });
    submitSessionMock.mockResolvedValue({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
      sessionId: 'session-1',
    });
  });

  it('uses the shared player card and routes a submitted attempt to the existing result page', async () => {
    render(
      <PremiumQuizPlayerClient
        quizId="quiz-1"
        slug="premium-quiz"
        title="Premium quiz"
        questionCount={1}
      />,
    );

    expect(await screen.findByText('Premium question?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Option B' }));
    await waitFor(() => expect(saveAnswerMock).toHaveBeenCalledWith('session-1', 0, 1));
    fireEvent.click(screen.getByRole('button', { name: 'submitQuiz' }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/quiz/premium-quiz/result?attemptId=attempt-1'),
    );
  });

  it('prefetches the next batch once when the learner reaches its second question', async () => {
    const question = (n: number) => ({
      id: `question-${n}`,
      question: `Question ${n}?`,
      options: ['No', 'Yes'],
      type: 'single',
    });
    const first = await startSessionMock.getMockImplementation()?.();
    startSessionMock.mockResolvedValue({
      ...first,
      totalQuestions: 4,
      questions: [question(1), question(2), question(3)],
      nextCursor: 'cursor-1',
      currentQuestionIndex: 1,
      answers: [null, null, null, null],
    });
    vi.mocked(fetchPremiumBatch).mockResolvedValue({
      ...first,
      totalQuestions: 4,
      batchIndex: 1,
      startIndex: 3,
      questions: [question(4)],
      answers: [null, null, null, null],
    });
    renderPlayer();

    expect(await screen.findByText('Question 2?')).toBeInTheDocument();
    await waitFor(() => expect(fetchPremiumBatch).toHaveBeenCalledWith('session-1', 'cursor-1'));
    // Loading the batch re-runs the effect; the loaded batch stops a second request.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPremiumBatch).toHaveBeenCalledTimes(1);
  });

  it('hides the source subtitle and labels the unlock button with the credit coin and its cost (RIN-1014)', async () => {
    startSessionMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Premium access required',
        status: 403,
        payload: { success: false, error: { code: 'premium_required' } },
        code: 'premium_required',
      }),
    );

    render(
      <PremiumQuizPlayerClient
        quizId="quiz-1"
        slug="premium-quiz"
        title="Premium quiz"
        questionCount={1}
      />,
    );

    const unlockButton = await screen.findByRole('button', { name: 'premiumUnlockButton' });
    expect(screen.queryByText(/LMS HUST Attempt review/i)).not.toBeInTheDocument();
    expect(unlockButton).toHaveTextContent('premiumUnlockButton');
    // The player is a section of the app layout, which owns the only <main>.
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(unlockButton.querySelector('img')?.getAttribute('src')).toContain(
      'premium-credit-coin.png',
    );

    fireEvent.click(unlockButton);
    await waitFor(() => expect(unlockMock).toHaveBeenCalledWith('quiz-1'));
  });

  it('asks a signed-out player to sign in on 401 instead of showing the raw server message', async () => {
    startSessionMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Unauthorized', status: 401, payload: {} }),
    );

    render(
      <PremiumQuizPlayerClient
        quizId="quiz-1"
        slug="premium-quiz"
        title="Premium quiz"
        questionCount={1}
      />,
    );

    const signIn = await screen.findByRole('link', { name: 'premiumSignInButton' });
    expect(signIn).toHaveAttribute('href', '/login?callbackUrl=%2Fquiz%2Fpremium-quiz');
    expect(screen.getByRole('heading', { name: 'Premium quiz' })).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('asks to sign in again when the session expires mid-play (401 on save)', async () => {
    saveAnswerMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Unauthorized', status: 401, payload: {} }),
    );

    render(
      <PremiumQuizPlayerClient
        quizId="quiz-1"
        slug="premium-quiz"
        title="Premium quiz"
        questionCount={1}
      />,
    );

    fireEvent.click(await screen.findByRole('radio', { name: 'Option B' }));

    expect(await screen.findByRole('link', { name: 'premiumSignInButton' })).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('shows the page-level server error with a retry, never the server message', async () => {
    startSessionMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Mongo exploded at shard 3', status: 500, payload: {} }),
    );

    renderPlayer();

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('errors.api.server');
    expect(screen.queryByText(/Mongo exploded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('Premium question?')).toBeInTheDocument();
  });

  it.each([
    {
      label: 'a bare 403 (forbidden, not a paywall)',
      error: new ApiResponseError({
        message: 'Only the owner',
        status: 403,
        payload: {},
        code: 'forbidden',
      }),
      title: 'errors.api.forbiddenTitle',
    },
    {
      label: '404',
      error: new ApiResponseError({ message: 'Premium quiz not found', status: 404, payload: {} }),
      title: 'errors.api.notFoundTitle',
    },
    {
      label: '429',
      error: new ApiResponseError({
        message: 'Slow down there',
        status: 429,
        payload: {},
        retryAfterSeconds: 12,
      }),
      title: 'errors.api.rateLimitedSecondsTitle',
    },
    {
      label: 'network failure',
      error: new TypeError('Failed to fetch'),
      title: 'errors.api.networkTitle',
    },
  ])('start fails with $label: page error from the error layer', async ({ error, title }) => {
    startSessionMock.mockRejectedValueOnce(error);

    renderPlayer();

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'premiumUnlockButton' })).not.toBeInTheDocument();
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
  });

  it('shows localized copy when the unlock fails, never the server text', async () => {
    startSessionMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Premium access required',
        status: 403,
        payload: {},
        code: 'premium_required',
      }),
    );
    unlockMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'wallet 42 empty',
        status: 403,
        payload: {},
        code: 'quota_exceeded',
      }),
    );

    renderPlayer();
    fireEvent.click(await screen.findByRole('button', { name: 'premiumUnlockButton' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.codes.quotaExceeded');
    expect(screen.queryByText(/wallet 42/)).not.toBeInTheDocument();
  });
});
