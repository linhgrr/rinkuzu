/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, SubmitResult, TranslateFn } from '@/features/adaptive/types/learning';
import type { SessionHistoryDetail } from '@/features/adaptive/types/history';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';

const {
  pushMock,
  prefetchMock,
  getSessionExerciseOutcomeMock,
  getJobIdForSessionMock,
  getSubjectHistoryDetailFreshMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
  getSessionExerciseOutcomeMock: vi.fn(),
  getJobIdForSessionMock: vi.fn(),
  getSubjectHistoryDetailFreshMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    prefetch: prefetchMock,
  }),
}));

vi.mock('@/features/adaptive/lib/session-storage', () => ({
  getSessionExerciseOutcome: getSessionExerciseOutcomeMock,
  getJobIdForSession: getJobIdForSessionMock,
}));

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  getSubjectHistoryDetailFresh: getSubjectHistoryDetailFreshMock,
}));

import { useResultState } from '@/features/adaptive/hooks/use-result-state';

const t: TranslateFn = ((key: string) => key) as TranslateFn;

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-1',
    exercise_id: 'exercise-1',
    concept_name: 'Concept',
    concept_idx: 0,
    bloom_level: 1,
    bloom_label: 'Remember',
    exercise_type: 'mcq',
    question: 'What is 2+2?',
    options: { B: 'Three', A: 'Four' },
    items: [],
    pairs: [],
    right_items: [],
    step: 1,
    max_steps: 5,
    ...overrides,
  };
}

function createResult(overrides: Partial<SubmitResult> = {}): SubmitResult {
  return {
    is_correct: true,
    correct_option: 'A',
    explanation: 'Because four',
    concept_name: 'Concept',
    bloom_level: 1,
    mastery_after: 0.75,
    avg_mastery: 0.5,
    step: 1,
    session_completed: false,
    stats: {
      total_correct: 1,
      total_answered: 1,
      accuracy: 100,
    },
    ...overrides,
  };
}

function createHistoryDetail(overrides: Partial<SessionHistoryDetail> = {}): SessionHistoryDetail {
  return {
    job_id: 'job-1',
    filename: 'subject.pdf',
    subject_id: 'subject-1',
    status: 'active',
    total_correct: 1,
    total_answered: 2,
    accuracy: 50,
    step: 2,
    max_steps: 5,
    avg_mastery: 0.4,
    unlocked_concepts: 1,
    locked_concepts: 0,
    mastered_concepts: 0,
    progress_percent: 40,
    concept_names: { c0: 'Concept' },
    concept_mastery: [0.8],
    bloom_mastery: [[0.8]],
    exercise_history: [
      {
        exercise_id: 'ex-old',
        concept_idx: 0,
        concept_name: 'Concept',
        bloom_level: 1,
        question: 'Old?',
        explanation: 'Old explanation',
        explanation_correct: 'Correct',
        explanation_incorrect: 'Incorrect',
        exercise_type: 'mcq',
        options: { A: 'A1' },
        items: [],
        pairs: [],
        right_items: [],
        correct_option: 'A',
        theory: null,
        user_answer: 'A',
        is_correct: true,
        timestamp: 100,
      },
      {
        exercise_id: 'ex-latest',
        concept_idx: 0,
        concept_name: 'Concept',
        bloom_level: 2,
        question: 'Latest?',
        explanation: 'Latest explanation',
        explanation_correct: 'Correct',
        explanation_incorrect: 'Incorrect',
        exercise_type: 'mcq',
        options: { A: 'Yes', B: 'No' },
        items: [],
        pairs: [],
        right_items: [],
        correct_option: 'B',
        theory: null,
        user_answer: 'B',
        is_correct: false,
        timestamp: 200,
        sentence: 'Sentence',
        statement: 'Statement',
        hint: 'Hint',
        rubric: ['Rubric'],
        correct_answer: 'B',
      },
      {
        exercise_id: 'ex-unanswered',
        concept_idx: 0,
        concept_name: 'Concept',
        bloom_level: 1,
        question: 'Skip?',
        explanation: '',
        explanation_correct: '',
        explanation_incorrect: '',
        exercise_type: 'mcq',
        options: { A: 'A' },
        items: [],
        pairs: [],
        right_items: [],
        correct_option: 'A',
        theory: null,
        user_answer: null,
        is_correct: null,
        timestamp: 300,
      },
    ],
    created_at: 1,
    updated_at: 2,
    last_session_id: 'session-1',
    ...overrides,
  } as SessionHistoryDetail;
}

describe('useResultState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionExerciseOutcomeMock.mockReturnValue(null);
    getJobIdForSessionMock.mockReturnValue(null);
    getSubjectHistoryDetailFreshMock.mockResolvedValue(createHistoryDetail());
  });

  it('hydrates from stored session outcome and derives display values', async () => {
    const exercise = createExercise();
    const result = createResult();
    getSessionExerciseOutcomeMock.mockReturnValue({ exercise, result });

    const { result: hook } = renderHook(() => useResultState('session-1', t));

    expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);
    expect(prefetchMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-1'));

    await waitFor(() => {
      expect(hook.current.hydrating).toBe(false);
    });

    expect(hook.current.result).toEqual(result);
    expect(hook.current.exercise).toEqual(exercise);
    expect(hook.current.isCorrect).toBe(true);
    expect(hook.current.masteryPercent).toBe(75);
    expect(hook.current.averageMasteryPercent).toBe(50);
    expect(hook.current.questionOptions).toEqual(['Four', 'Three']);
    expect(hook.current.chatContext).toContain('chatbot.contextConcept');
    expect(hook.current.chatContext).toContain('What is 2+2?');
    expect(getSubjectHistoryDetailFreshMock).not.toHaveBeenCalled();
  });

  it('derives the latest answered exercise from history when no stored outcome exists', async () => {
    getJobIdForSessionMock.mockReturnValue('job-1');

    const { result: hook } = renderHook(() => useResultState('session-1', t));

    await waitFor(() => {
      expect(hook.current.hydrating).toBe(false);
    });

    expect(getSubjectHistoryDetailFreshMock).toHaveBeenCalledWith('job-1');
    expect(hook.current.exercise).toMatchObject({
      exercise_id: 'ex-latest',
      bloom_label: 'Understand',
      sentence: 'Sentence',
      statement: 'Statement',
      hint: 'Hint',
      rubric: ['Rubric'],
      correct_answer: 'B',
      step: 2,
      max_steps: 5,
    });
    expect(hook.current.result).toMatchObject({
      is_correct: false,
      explanation: 'Latest explanation',
      mastery_after: 0.8,
      avg_mastery: 0.4,
      session_completed: false,
      stats: {
        total_correct: 1,
        total_answered: 2,
        accuracy: 50,
      },
    });
    expect(hook.current.isCorrect).toBe(false);
    expect(hook.current.masteryPercent).toBe(80);
    expect(hook.current.averageMasteryPercent).toBe(40);
  });

  it('marks the session completed when history status is completed or max steps reached', async () => {
    getJobIdForSessionMock.mockReturnValue('job-1');
    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({ status: 'completed' }),
    );

    const { result: completedHook } = renderHook(() => useResultState('session-1', t));
    await waitFor(() => {
      expect(completedHook.current.hydrating).toBe(false);
    });
    expect(completedHook.current.result?.session_completed).toBe(true);

    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({
        status: 'active',
        max_steps: 2,
      }),
    );
    const { result: maxStepsHook } = renderHook(() => useResultState('session-2', t));
    await waitFor(() => {
      expect(maxStepsHook.current.hydrating).toBe(false);
    });
    expect(maxStepsHook.current.result?.session_completed).toBe(true);
  });

  it('clears state when history derivation throws for unsupported bloom, mastery, or correctness', async () => {
    getJobIdForSessionMock.mockReturnValue('job-1');
    const baseAnswered = createHistoryDetail().exercise_history.find(
      (item) => item.user_answer !== null,
    );
    expect(baseAnswered).toBeDefined();
    if (!baseAnswered) throw new Error('expected answered exercise fixture');

    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({
        exercise_history: [
          {
            ...baseAnswered,
            bloom_level: 99,
            user_answer: 'A',
            is_correct: true,
            timestamp: 500,
          },
        ],
      }),
    );
    const { result: badBloom } = renderHook(() => useResultState('session-bloom', t));
    await waitFor(() => {
      expect(badBloom.current.hydrating).toBe(false);
    });
    expect(badBloom.current.result).toBeNull();
    expect(badBloom.current.exercise).toBeNull();

    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({
        concept_mastery: [],
        exercise_history: [
          {
            ...baseAnswered,
            concept_idx: 5,
            user_answer: 'A',
            is_correct: true,
            timestamp: 500,
          },
        ],
      }),
    );
    const { result: badMastery } = renderHook(() => useResultState('session-mastery', t));
    await waitFor(() => {
      expect(badMastery.current.hydrating).toBe(false);
    });
    expect(badMastery.current.result).toBeNull();

    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({
        exercise_history: [
          {
            ...baseAnswered,
            user_answer: 'A',
            is_correct: null,
            timestamp: 500,
          },
        ],
      }),
    );
    const { result: badCorrectness } = renderHook(() => useResultState('session-correctness', t));
    await waitFor(() => {
      expect(badCorrectness.current.hydrating).toBe(false);
    });
    expect(badCorrectness.current.result).toBeNull();
  });

  it('clears state when history has no answers, no job, or hydration fails', async () => {
    getJobIdForSessionMock.mockReturnValue('job-1');
    getSubjectHistoryDetailFreshMock.mockResolvedValueOnce(
      createHistoryDetail({
        exercise_history: [
          {
            exercise_id: 'ex-unanswered',
            concept_idx: 0,
            concept_name: 'Concept',
            bloom_level: 1,
            question: 'Skip?',
            explanation: '',
            explanation_correct: '',
            explanation_incorrect: '',
            exercise_type: 'mcq',
            options: { A: 'A' },
            items: [],
            pairs: [],
            right_items: [],
            correct_option: 'A',
            theory: null,
            user_answer: null,
            is_correct: null,
            timestamp: 1,
          },
        ],
      } as Partial<SessionHistoryDetail>),
    );

    const { result: emptyHook } = renderHook(() => useResultState('session-1', t));
    await waitFor(() => {
      expect(emptyHook.current.hydrating).toBe(false);
    });
    expect(emptyHook.current.result).toBeNull();
    expect(emptyHook.current.exercise).toBeNull();
    expect(emptyHook.current.questionOptions).toEqual([]);
    expect(emptyHook.current.chatContext).toBe('');
    expect(emptyHook.current.isCorrect).toBe(false);
    expect(emptyHook.current.masteryPercent).toBe(0);
    expect(emptyHook.current.averageMasteryPercent).toBe(0);

    getJobIdForSessionMock.mockReturnValue(null);
    const { result: noJobHook } = renderHook(() => useResultState('session-2', t));
    await waitFor(() => {
      expect(noJobHook.current.hydrating).toBe(false);
    });
    expect(noJobHook.current.result).toBeNull();

    getJobIdForSessionMock.mockReturnValue('job-err');
    getSubjectHistoryDetailFreshMock.mockRejectedValueOnce(new Error('network'));
    const { result: errorHook } = renderHook(() => useResultState('session-3', t));
    await waitFor(() => {
      expect(errorHook.current.hydrating).toBe(false);
    });
    expect(errorHook.current.result).toBeNull();
  });

  it('navigates dashboard/next and toggles chat open state', async () => {
    const exercise = createExercise();
    const result = createResult({ session_completed: false });
    getSessionExerciseOutcomeMock.mockReturnValue({ exercise, result });

    const { result: hook } = renderHook(() => useResultState('session-1', t));
    await waitFor(() => {
      expect(hook.current.hydrating).toBe(false);
    });

    act(() => {
      hook.current.handleGoDashboard();
    });
    expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.dashboard);

    act(() => {
      hook.current.handleNext();
    });
    expect(pushMock).toHaveBeenCalledWith(ADAPTIVE_ROUTES.exercise('session-1'));

    act(() => {
      hook.current.openChat();
    });
    expect(hook.current.isChatOpen).toBe(true);

    act(() => {
      hook.current.closeChat();
    });
    expect(hook.current.isChatOpen).toBe(false);

    getSessionExerciseOutcomeMock.mockReturnValue({
      exercise,
      result: createResult({ session_completed: true }),
    });
    const { result: completedHook } = renderHook(() => useResultState('session-1', t));
    await waitFor(() => {
      expect(completedHook.current.hydrating).toBe(false);
    });
    act(() => {
      completedHook.current.handleNext();
    });
    expect(pushMock).toHaveBeenLastCalledWith(ADAPTIVE_ROUTES.dashboard);

    getSessionExerciseOutcomeMock.mockReturnValue(null);
    getJobIdForSessionMock.mockReturnValue(null);
    const { result: emptyHook } = renderHook(() => useResultState('session-empty', t));
    await waitFor(() => {
      expect(emptyHook.current.hydrating).toBe(false);
    });
    pushMock.mockClear();
    act(() => {
      emptyHook.current.handleNext();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
