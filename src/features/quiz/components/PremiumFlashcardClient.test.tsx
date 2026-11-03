/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { PremiumFlashcardClient } from './PremiumFlashcardClient';

const { startMock, unlockMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  unlockMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/quiz/premium-quiz/flashcards',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stable identity, like next-intl's memoized `t` (see PremiumQuizPlayerClient.test).
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  fetchPremiumFlashcard: vi.fn(),
  revealPremiumFlashcard: vi.fn(),
  startPremiumFlashcardSession: (...args: unknown[]) => startMock(...args),
  unlockPremiumQuiz: (...args: unknown[]) => unlockMock(...args),
}));

const card = {
  sessionId: 'session-1',
  title: 'Premium deck',
  watermark: 'USER · SESSION',
  questionIndex: 0,
  totalQuestions: 2,
  revealCursor: 'reveal-1',
  question: { question: 'Premium card?', options: ['No', 'Yes'], type: 'single' },
};

function renderDeck() {
  return render(
    <PremiumFlashcardClient
      metadata={{ quizId: 'quiz-1', title: 'Premium deck', questionCount: 2 }}
      slug="premium-quiz"
    />,
  );
}

describe('PremiumFlashcardClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMock.mockResolvedValue(card);
    unlockMock.mockResolvedValue({ granted: true });
  });

  it('asks a guest to sign in and come back to the quiz on 401, never "Unauthorized"', async () => {
    startMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Unauthorized', status: 401, payload: {} }),
    );

    renderDeck();

    const signIn = await screen.findByRole('link', { name: 'premiumSignInButton' });
    expect(signIn).toHaveAttribute('href', '/login?callbackUrl=%2Fquiz%2Fpremium-quiz');
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('offers the unlock on premium_required and starts the deck once unlocked', async () => {
    startMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Premium subscription or one credit is required',
        status: 403,
        payload: {},
        code: 'premium_required',
      }),
    );

    renderDeck();
    fireEvent.click(await screen.findByRole('button', { name: 'premiumUnlockButton' }));

    expect(await screen.findByText('Premium card?')).toBeInTheDocument();
    expect(unlockMock).toHaveBeenCalledWith('quiz-1');
  });

  it('does not offer an unlock for a bare 403 forbidden', async () => {
    startMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Email not verified',
        status: 403,
        payload: {},
        code: 'forbidden',
      }),
    );

    renderDeck();

    expect(
      await screen.findByRole('heading', { name: 'errors.api.forbiddenTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'premiumUnlockButton' })).not.toBeInTheDocument();
    expect(screen.queryByText('Email not verified')).not.toBeInTheDocument();
  });

  it('shows the page-level server error with a working retry, never the server text', async () => {
    startMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Mongo exploded at shard 3', status: 500, payload: {} }),
    );

    renderDeck();

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mongo exploded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('Premium card?')).toBeInTheDocument();
  });

  it('shows localized copy when the unlock fails', async () => {
    startMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Premium access required',
        status: 403,
        payload: {},
        code: 'premium_required',
      }),
    );
    unlockMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'wallet 42 empty', status: 500, payload: {} }),
    );

    renderDeck();
    fireEvent.click(await screen.findByRole('button', { name: 'premiumUnlockButton' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.server');
    expect(screen.queryByText(/wallet 42/)).not.toBeInTheDocument();
  });
});
