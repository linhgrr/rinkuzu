/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progress, session, submission } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: () => undefined, refresh: () => undefined },
  progress: {
    loadProgress: () => Promise.resolve(null),
    saveProgress: () => undefined,
    flushSave: () => undefined,
    clearProgress: () => Promise.resolve(),
  },
  session: {
    data: { user: { email: 'learner@example.test' } },
    status: 'authenticated',
  },
  submission: {
    onSubmitSuccess: null as null | ((attemptId: string, score: number) => Promise<void>),
  },
}));

vi.mock('next-auth/react', () => ({ useSession: () => session }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/fake-starter',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({ useQuizProgress: () => progress }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  captureAnalyticsEventOnce: vi.fn(),
}));
vi.mock('@/features/quiz/hooks/useQuizSubmission', () => ({
  useQuizSubmission: (options: {
    onSubmitSuccess: (attemptId: string, score: number) => Promise<void>;
  }) => {
    submission.onSubmitSuccess = options.onSubmitSuccess;
    return {
      submitting: false,
      showSubmitConfirm: false,
      setShowSubmitConfirm: () => undefined,
      unansweredCount: 0,
      handleQuizComplete: () => true,
      completeSubmit: () => undefined,
      submitQuiz: () => Promise.resolve(true),
    };
  },
}));

const quiz = {
  id: 'quiz-1',
  title: 'Fake starter',
  slug: 'fake-starter',
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

function renderPlayer(entry?: string | null) {
  return render(
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={quiz}
      slug="fake-starter"
      {...(entry === undefined ? {} : { entry })}
    />,
  );
}

async function completeQuiz() {
  await waitFor(() => expect(submission.onSubmitSuccess).not.toBeNull());
  await submission.onSubmitSuccess?.('attempt-1', 80);
  return vi
    .mocked(captureAnalyticsEvent)
    .mock.calls.find(([event]) => event === 'quiz_completed')?.[1];
}

describe('QuizPlayerClient post-sign-in starter entry (RIN-913)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submission.onSubmitSuccess = null;
  });

  it('shows the intro with Skip above question 1 only for entry=post_signin_starter', async () => {
    renderPlayer('post_signin_starter');

    expect(await screen.findByText('starterIntro', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'starterSkip' })).toHaveAttribute('href', '/dashboard');
  });

  it.each([undefined, null, 'newsletter'])('shows no intro for entry=%s', async (entry) => {
    renderPlayer(entry);

    expect(await screen.findByText('Two plus two?', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.queryByText('starterIntro')).not.toBeInTheDocument();
  });

  it('tags quiz_completed with the entry on the starter path', async () => {
    renderPlayer('post_signin_starter');

    expect(await completeQuiz()).toMatchObject({ entry: 'post_signin_starter', score: 80 });
  });

  it('leaves entry out of quiz_completed otherwise', async () => {
    renderPlayer();

    expect(await completeQuiz()).not.toHaveProperty('entry');
  });
});
