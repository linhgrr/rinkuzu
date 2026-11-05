/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { findGuestClaimToken } from '@/features/quiz/lib/guest-claims';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { refreshMock, pushMock, router, progress } = vi.hoisted(() => {
  const refresh = vi.fn();
  const push = vi.fn();
  return {
    refreshMock: refresh,
    pushMock: push,
    router: { push, back: () => undefined, refresh },
    progress: {
      loadProgress: () => Promise.resolve(null),
      saveProgress: () => undefined,
      flushSave: () => undefined,
      clearProgress: () => Promise.resolve(),
    },
  };
});
const noSession = { data: null, status: 'unauthenticated' };

vi.mock('next-auth/react', () => ({
  useSession: () => noSession,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/private-quiz',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stable identity, like next-intl's memoized `t`.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({
  useQuizProgress: () => progress,
}));

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  captureAnalyticsEventOnce: vi.fn(),
}));
vi.mock('@/features/quiz/api/quiz-interaction-api', () => ({
  submitQuizAttemptViewModel: vi.fn(),
}));
// The real layouts load lazily and take seconds on a cold worker; this stub shows
// question 1 and submits through the player's real useQuizSubmission.
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => ({
  DesktopQuizLayout: ({
    currentQuestion,
    error,
    submit,
  }: {
    currentQuestion: { question: string };
    error: string;
    submit: { complete: () => Promise<boolean> };
  }) => (
    <div data-testid="desktop-layout">
      <p>{currentQuestion.question}</p>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void submit.complete()}>
        stub-submit
      </button>
    </div>
  ),
}));

vi.mock('@/features/quiz/components/PremiumRequiredModal', () => ({
  PremiumRequiredModal: () => <div>premium-required-modal</div>,
}));

function renderFailedLoad(status: number | null, code: string | null = null) {
  return render(
    <QuizPlayerClient
      initialErrorCode={code}
      initialErrorStatus={status}
      initialQuiz={null}
      slug="private-quiz"
    />,
  );
}

describe('QuizPlayerClient load failures (RIN-753)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks a guest to sign in and come back to this quiz on 401', async () => {
    renderFailedLoad(401, 'unauthorized');

    expect(
      await screen.findByRole('heading', { name: 'errors.api.authRequiredTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'errors.api.actions.signIn' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fquiz%2Fprivate-quiz',
    );
  });

  it('opens the Premium upsell on premium_required, not an error page', async () => {
    renderFailedLoad(403, 'premium_required');

    expect(await screen.findByText('premium-required-modal')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /errors\.api/ })).not.toBeInTheDocument();
  });

  it.each([
    { status: 403, code: 'forbidden', title: 'errors.api.forbiddenTitle' },
    { status: 404, code: null, title: 'errors.api.notFoundTitle' },
    { status: 429, code: null, title: 'errors.api.rateLimitedTitle' },
  ])('maps a $status to its page error', async ({ status, code, title }) => {
    renderFailedLoad(status, code);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('offers a retry that re-runs the server load on a 500', async () => {
    renderFailedLoad(500, 'internal_error');

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});

// RIN-912: play first. A signed-out learner gets question 1 with no email gate and
// submits with a guest claim token (replaces the RIN-682 contrast test of the removed gate).
describe('QuizPlayerClient signed-out play (RIN-912)', () => {
  const quiz = {
    id: 'quiz-1',
    title: 'Fake quiz',
    slug: 'private-quiz',
    author: null,
    folder: null,
    visibility: 'public' as const,
    questionCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    questions: [
      { id: 'q1', question: 'Two plus two?', options: ['3', '4'], type: 'single' as const },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  function renderPlayer() {
    return render(
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorStatus={null}
        initialQuiz={quiz}
        slug="private-quiz"
      />,
    );
  }

  it('shows question 1 straight away with no email field', async () => {
    renderPlayer();

    expect(await screen.findByText('Two plus two?')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'startQuiz' })).not.toBeInTheDocument();
  });

  it('submits with a guest claim token and no email, reuses it on retry, keeps the URL clean', async () => {
    vi.mocked(submitQuizAttemptViewModel)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        score: 100,
        correctAnswers: 1,
        totalQuestions: 1,
      });
    renderPlayer();

    fireEvent.click(await screen.findByRole('button', { name: 'stub-submit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'stub-submit' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledOnce());

    const [first, retry] = vi.mocked(submitQuizAttemptViewModel).mock.calls.map(([input]) => input);
    expect(first?.guestClaimToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(retry?.guestClaimToken).toBe(first?.guestClaimToken);
    expect(retry?.idempotencyKey).toBe(first?.idempotencyKey);
    expect(first).not.toHaveProperty('userEmail');
    expect(retry).not.toHaveProperty('userEmail');
    expect(findGuestClaimToken('attempt-1')).toBe(first?.guestClaimToken);
    expect(pushMock).toHaveBeenCalledWith('/quiz/private-quiz/result?attemptId=attempt-1&score=100');
    // The token never reaches analytics.
    expect(JSON.stringify(vi.mocked(captureAnalyticsEvent).mock.calls)).not.toContain(
      first?.guestClaimToken,
    );
  });
});
