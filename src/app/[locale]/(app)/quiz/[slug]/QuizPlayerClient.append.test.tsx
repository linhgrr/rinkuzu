/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPlayerClient from './QuizPlayerClient';

// Stable identities: the player's load effect depends on the router and progress callbacks.
const { router, progress, layout } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: () => undefined, refresh: vi.fn() },
  progress: {
    loadProgress: () => Promise.resolve(null),
    saveProgress: () => undefined,
    flushSave: () => undefined,
    clearProgress: () => Promise.resolve(),
  },
  layout: {
    current: null as null | {
      questions: { id: string; options: string[] }[];
      currentQuestionIndex: number;
      userAnswers: unknown[];
      selectAnswer: (index: number) => void;
      nextQuestion: () => void;
      submit: { complete: () => Promise<boolean> };
    },
  },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/try/pdf/play',
}));
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('@/features/quiz/hooks/useQuizProgress', () => ({ useQuizProgress: () => progress }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: vi.fn(),
  captureAnalyticsEventOnce: vi.fn(),
}));
// The real layouts load lazily; this stub exposes what the player hands them.
vi.mock('@/features/quiz/components/player/DesktopQuizLayout', () => ({
  DesktopQuizLayout: (props: NonNullable<typeof layout.current>) => {
    layout.current = props;
    return (
      <div
        data-testid="desktop-layout"
        data-count={props.questions.length}
        data-index={props.currentQuestionIndex}
      />
    );
  },
}));

const question = (id: string) => ({
  id,
  question: `Fake question ${id}?`,
  options: ['A', 'B', 'C'],
  type: 'single' as const,
});

const firstBatch = {
  id: 'guest-draft-play',
  slug: 'guest-draft-play',
  title: 'Fake draft',
  author: null,
  folder: null,
  visibility: 'public' as const,
  questionCount: 2,
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
  questions: [question('q1'), question('q2')],
};

const submitAttempt = vi.fn();

function player(moreQuestions: ReturnType<typeof question>[]) {
  return (
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={firstBatch}
      slug="guest-draft-play"
      mode="full"
      guestDraft={{ submitAttempt, notice: null, moreQuestions }}
    />
  );
}

const current = () => {
  if (!layout.current) throw new Error('layout not rendered');
  return layout.current;
};

describe('QuizPlayerClient: questions appended mid-round (RIN-1620)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    layout.current = null;
    submitAttempt.mockResolvedValue({ attemptId: 'attempt-1', score: 100 });
  });

  it('appends the rest at the end and keeps the current question and the answers', async () => {
    const view = render(player([]));
    await screen.findByTestId('desktop-layout');
    act(() => current().selectAnswer(1));
    act(() => current().nextQuestion());
    act(() => current().selectAnswer(2));
    const opened = current().questions.map((item) => item.id);

    view.rerender(player([question('q3'), question('q4')]));

    await waitFor(() => expect(current().questions).toHaveLength(4));
    expect(current().currentQuestionIndex).toBe(1);
    expect(
      current()
        .questions.slice(0, 2)
        .map((item) => item.id),
    ).toEqual(opened);
    expect(
      current()
        .questions.slice(2)
        .map((item) => item.id),
    ).toEqual(['q3', 'q4']);
    expect(current().userAnswers).toEqual([1, 2, -1, -1]);

    // The same rest again (a new array from the next poll) appends nothing.
    view.rerender(player([question('q3'), question('q4')]));
    await waitFor(() => expect(current().questions).toHaveLength(4));
  });

  it('submits over the questions present, in the order of the quiz', async () => {
    const view = render(player([]));
    await screen.findByTestId('desktop-layout');
    view.rerender(player([question('q3')]));
    await waitFor(() => expect(current().questions).toHaveLength(3));

    await act(async () => {
      await current().submit.complete();
    });

    expect(submitAttempt).toHaveBeenCalledOnce();
    const [input] = submitAttempt.mock.calls[0] as [{ answers: unknown[] }];
    expect(input.answers).toEqual([-1, -1, -1]);
  });

  it('ends the round on the last question present: Next only once more arrive', async () => {
    const view = render(player([]));
    await screen.findByTestId('desktop-layout');
    act(() => current().nextQuestion());
    act(() => current().nextQuestion());
    // Question 2 of 2 is the last one present: there is no third to go to.
    expect(current().currentQuestionIndex).toBe(1);

    view.rerender(player([question('q3')]));
    await waitFor(() => expect(current().questions).toHaveLength(3));
    act(() => current().nextQuestion());
    expect(current().currentQuestionIndex).toBe(2);
  });
});
