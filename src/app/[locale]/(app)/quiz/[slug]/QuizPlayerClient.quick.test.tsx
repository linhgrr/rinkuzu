/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { readQuickRoundSeen } from '@/features/quiz/lib/quick-round-draw';
import QuizPlayerClient from './QuizPlayerClient';

type SubmissionOptions = {
  questionIndices?: number[];
  onSubmitSuccess: (attemptId: string, score: number) => Promise<void>;
};

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progress, session, submission } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: () => undefined, refresh: () => undefined },
  progress: {
    enabled: null as boolean | null,
    saved: null as null | Record<string, unknown>,
    api: {
      loadProgress: vi.fn(),
      saveProgress: () => undefined,
      flushSave: () => undefined,
      clearProgress: () => Promise.resolve(),
    },
  },
  session: {
    data: { user: { email: 'learner@example.test' } },
    status: 'authenticated',
  },
  submission: { options: null as SubmissionOptions | null },
}));

vi.mock('next-auth/react', () => ({ useSession: () => session }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/fake-quiz',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const translate = (key: string, values?: Record<string, unknown>) =>
  values?.['count'] !== undefined ? `${key}:${String(values['count'])}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({
  useQuizProgress: ({ enabled }: { enabled: boolean }) => {
    progress.enabled = enabled;
    return progress.api;
  },
}));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
function DesktopStub({ titleBadge, questions }: { titleBadge?: string; questions: unknown[] }) {
  return (
    <div data-testid="desktop-layout">
      {titleBadge} / {questions.length}
    </div>
  );
}
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => ({
  DesktopQuizLayout: DesktopStub,
}));
vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
    isOpen ? <div role="dialog">{title}</div> : null,
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  captureAnalyticsEventOnce: vi.fn(),
}));
vi.mock('@/features/quiz/hooks/useQuizSubmission', () => ({
  useQuizSubmission: (options: SubmissionOptions) => {
    submission.options = options;
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

function fakeQuiz(questionCount: number) {
  return {
    id: 'quiz-1',
    title: 'Fake long quiz',
    slug: 'fake-quiz',
    author: null,
    folder: null,
    visibility: 'public' as const,
    questionCount,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q${index}`,
      question: `Fake prompt ${index}`,
      options: ['a', 'b'],
      type: 'single' as const,
    })),
  };
}

function renderPlayer(questionCount: number, mode?: string) {
  return render(
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={fakeQuiz(questionCount)}
      slug="fake-quiz"
      {...(mode ? { mode } : {})}
    />,
  );
}

function startedEvents() {
  return vi.mocked(captureAnalyticsEvent).mock.calls.filter(([event]) => event === 'quiz_started');
}

describe('QuizPlayerClient quick round (RIN-933)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    progress.enabled = null;
    progress.api.loadProgress.mockResolvedValue(null);
    submission.options = null;
  });

  it('offers no choice on a quiz of 15 questions', async () => {
    renderPlayer(15);

    expect(await screen.findByTestId('desktop-layout')).toHaveTextContent('/ 15');
    expect(screen.queryByText('quickRound.start:10')).not.toBeInTheDocument();
    expect(startedEvents()).toEqual([['quiz_started', { mode: 'full', question_count: 15 }]]);
  });

  it('offers a quick round and the full quiz on a quiz of 16 questions', async () => {
    renderPlayer(16);

    expect(await screen.findByText('quickRound.start:10')).toBeInTheDocument();
    expect(screen.getByText('quickRound.full:16')).toBeInTheDocument();
    expect(screen.queryByText('quickRound.resumeHint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('desktop-layout')).not.toBeInTheDocument();
    expect(startedEvents()).toEqual([]);
  });

  it('starts the full quiz with saved progress from the choice', async () => {
    progress.api.loadProgress.mockResolvedValue({
      questionOrder: Array.from({ length: 16 }, (_, index) => index),
      optionOrders: Array.from({ length: 16 }, () => [0, 1]),
      userAnswers: Array.from({ length: 16 }, () => 0),
      currentQuestionIndex: 4,
      answeredCount: 5,
      totalQuestions: 16,
    });
    renderPlayer(16);

    expect(await screen.findByText('quickRound.resumeHint')).toBeInTheDocument();
    fireEvent.click(screen.getByText('quickRound.full:16'));

    expect(await screen.findByText('resumeTitle')).toBeInTheDocument();
    expect(progress.enabled).toBe(true);
    expect(submission.options?.questionIndices).toBeUndefined();
    expect(startedEvents()).toEqual([['quiz_started', { mode: 'full', question_count: 16 }]]);
  });

  it('skips the choice with ?mode=quick and plays 10 questions without saved progress', async () => {
    renderPlayer(30, 'quick');

    expect(await screen.findByTestId('desktop-layout')).toHaveTextContent('quickRound.pill / 10');
    expect(progress.enabled).toBe(false);
    expect(progress.api.loadProgress).not.toHaveBeenCalled();
    const indices = submission.options?.questionIndices ?? [];
    expect(new Set(indices).size).toBe(10);
    expect(startedEvents()).toEqual([['quiz_started', { mode: 'quick', question_count: 10 }]]);

    await act(() => submission.options?.onSubmitSuccess('attempt-1', 70) ?? Promise.resolve());

    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      'quiz_completed',
      expect.objectContaining({ mode: 'quick', question_count: 10 }),
    );
    expect(readQuickRoundSeen('fake-quiz')).toEqual([...indices].sort((a, b) => a - b));
  });

  it('starts the full quiz straight away with ?mode=full', async () => {
    renderPlayer(16, 'full');

    expect(await screen.findByTestId('desktop-layout')).toHaveTextContent('/ 16');
    await waitFor(() => expect(progress.enabled).toBe(true));
    expect(submission.options?.questionIndices).toBeUndefined();
  });
});
