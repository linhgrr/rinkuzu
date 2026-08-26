/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
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
  useRouter: () => ({ push: pushMock }),
}));

// next-intl memoizes `t` per namespace. Returning a fresh function here would
// change the identity of the player's effect dependency on every render, which
// re-runs the session bootstrap and races the assertions below.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate }));

vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  fetchPremiumBatch: vi.fn(),
  savePremiumAnswer: (...args: unknown[]) => saveAnswerMock(...args),
  startPremiumSession: (...args: unknown[]) => startSessionMock(...args),
  submitPremiumSession: (...args: unknown[]) => submitSessionMock(...args),
  unlockPremiumQuiz: (...args: unknown[]) => unlockMock(...args),
}));

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

  it('hides the source subtitle and renders the unlock cost as a credit icon with -1', async () => {
    startSessionMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Premium access required',
        status: 403,
        payload: { code: 'premium_required' },
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
    expect(unlockButton).toHaveTextContent('-1');
    expect(unlockButton.querySelector('img')?.getAttribute('src')).toContain(
      'premium-credit-coin.png',
    );

    fireEvent.click(unlockButton);
    await waitFor(() => expect(unlockMock).toHaveBeenCalledWith('quiz-1'));
  });
});
