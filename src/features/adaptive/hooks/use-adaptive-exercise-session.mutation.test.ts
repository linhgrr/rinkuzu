/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { getLearningStep, submitAnswer } from '@/features/adaptive/lib/adaptive-api-methods';
import type { Exercise, SubmitResult } from '@/features/adaptive/types/learning';
import {
  clearSessionExerciseDraft,
  getSessionExerciseDraft,
  saveSessionExerciseDraft,
  saveSessionExerciseOutcome,
} from '../lib/session-storage';
import { useAdaptiveExerciseSession } from './use-adaptive-exercise-session';

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  getLearningStep: vi.fn(),
  submitAnswer: vi.fn(),
}));

vi.mock('../lib/session-storage', () => ({
  clearSessionExerciseDraft: vi.fn(),
  getSessionExerciseDraft: vi.fn(),
  saveSessionExerciseDraft: vi.fn(),
  saveSessionExerciseOutcome: vi.fn(),
}));

const getLearningStepMock = vi.mocked(getLearningStep);
const submitAnswerMock = vi.mocked(submitAnswer);
const getDraftMock = vi.mocked(getSessionExerciseDraft);
const saveDraftMock = vi.mocked(saveSessionExerciseDraft);
const saveOutcomeMock = vi.mocked(saveSessionExerciseOutcome);
const clearDraftMock = vi.mocked(clearSessionExerciseDraft);

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-1',
    exercise_id: 'exercise-1',
    concept_name: 'Concept',
    concept_idx: 0,
    bloom_level: 1,
    bloom_label: 'Remember',
    exercise_type: 'mcq',
    question: 'Question?',
    options: { A: 'Answer A', B: 'Answer B' },
    items: [],
    pairs: [],
    right_items: [],
    step: 0,
    max_steps: 5,
    ...overrides,
  };
}

function createStep(label: string, exercise = createExercise()) {
  return {
    concept: {
      concept_name: label,
      concept_idx: 0,
      bloom_level: 1,
      bloom_label: 'Remember' as const,
      step: 0,
      max_steps: 5,
    },
    theory: null,
    exercise,
    cache_status: 'created' as const,
  } satisfies Awaited<ReturnType<typeof getLearningStep>>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  };
}

const t = (key: string) => `t:${key}`;

beforeEach(() => {
  vi.clearAllMocks();
  getDraftMock.mockReturnValue(null);
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn().mockReturnValueOnce('submit-key-1').mockReturnValueOnce('submit-key-2'),
  });
});

describe('useAdaptiveExerciseSession mutation coverage', () => {
  it('maps aborted and unavailable load errors to service-unavailable feedback', async () => {
    getLearningStepMock
      .mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'aborted',
          code: 'request_aborted',
          status: 499,
          retryable: true,
        }),
      )
      .mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'down',
          code: 'service_unavailable',
          status: 503,
          retryable: true,
        }),
      )
      .mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'bad',
          code: 'pipeline_not_completed',
          status: 409,
          retryable: false,
        }),
      );

    const router = createRouter();
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAdaptiveExerciseSession({ sessionId, router, t }),
      { initialProps: { sessionId: 'session-aborted' } },
    );

    await waitFor(() => expect(result.current.error).toBe('t:exercise.serviceUnavailable'));
    expect(result.current).toMatchObject({
      loadingConcept: false,
      loadingTheory: false,
      loadingExercise: false,
      showTheory: false,
      concept: null,
      exercise: null,
    });

    rerender({ sessionId: 'session-unavailable' });
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBe('t:exercise.serviceUnavailable'));

    rerender({ sessionId: 'session-generic-api' });
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.error).toBe('t:exercise.failedToLoadExercise'));
  });

  it('maps session_not_found load errors without treating them as service unavailable', async () => {
    getLearningStepMock.mockRejectedValueOnce(new Error('session_not_found'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'missing', router: createRouter(), t }),
    );

    await waitFor(() => expect(result.current.error).toBe('t:exercise.failedToLoadExercise'));
    expect(result.current.loadingConcept).toBe(false);
    expect(result.current.loadingExercise).toBe(false);
  });

  it('ignores stale load failures after the session changes', async () => {
    const first = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    const second = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    getLearningStepMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const router = createRouter();
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAdaptiveExerciseSession({ sessionId, router, t }),
      { initialProps: { sessionId: 'session-a' } },
    );
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledWith('session-a'));

    rerender({ sessionId: 'session-b' });
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledWith('session-b'));

    second.resolve(createStep('concept-b'));
    await waitFor(() => expect(result.current.concept?.concept_name).toBe('concept-b'));

    first.reject(new Error('stale failure'));
    await act(async () => {
      try {
        await first.promise;
      } catch {
        // expected
      }
    });
    expect(result.current.error).toBeNull();
    expect(result.current.concept?.concept_name).toBe('concept-b');
    expect(result.current.loadingExercise).toBe(false);
  });

  it('creates an initial answer draft when no saved draft exists and shows theory when present', async () => {
    getLearningStepMock.mockResolvedValueOnce({
      ...createStep('concept-a'),
      theory: { content: 'Theory body', examples: ['e1'] },
    });
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );

    await waitFor(() => expect(result.current.concept?.concept_name).toBe('concept-a'));
    expect(result.current.answerDraft).toEqual({ type: 'mcq', selection: null });
    expect(result.current.showTheory).toBe(true);
    expect(result.current.theory).toEqual({ content: 'Theory body', examples: ['e1'] });
    expect(result.current.loadingConcept).toBe(false);
    expect(result.current.loadingTheory).toBe(false);
    expect(result.current.loadingExercise).toBe(false);
  });

  it('prefeches dashboard and result routes for the active session', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const router = createRouter();
    const { rerender } = renderHook(
      ({ sessionId }) => useAdaptiveExerciseSession({ sessionId, router, t }),
      { initialProps: { sessionId: 'session-a' } },
    );
    await waitFor(() => expect(router.prefetch).toHaveBeenCalledWith('/adaptive'));
    expect(router.prefetch).toHaveBeenCalledWith('/adaptive/result/session-a');

    rerender({ sessionId: 'session-b' });
    await waitFor(() => expect(router.prefetch).toHaveBeenCalledWith('/adaptive/result/session-b'));
  });

  it('falls back to a deterministic idempotency key when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockResolvedValue({} as SubmitResult);
    const router = createRouter();
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router, t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));
    await act(async () => result.current.handleSubmit());

    expect(submitAnswerMock).toHaveBeenCalledWith(
      'session-a',
      expect.objectContaining({
        exercise_id: 'exercise-1',
        idempotency_key: `exercise-1-${now}`,
        answer: { choice: 'A' },
      }),
    );
    expect(saveOutcomeMock).toHaveBeenCalledWith(
      'session-a',
      expect.objectContaining({
        exercise: expect.objectContaining({ exercise_id: 'exercise-1' }),
      }),
    );
    expect(clearDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1');
    expect(router.push).toHaveBeenCalledWith('/adaptive/result/session-a');
    expect(result.current.submitting).toBe(false);
  });

  it('does not update submit error state after unmount during a failed submit', async () => {
    const pending = deferred<SubmitResult>();
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    let submit!: Promise<void>;
    act(() => {
      submit = result.current.handleSubmit();
    });
    await waitFor(() => expect(submitAnswerMock).toHaveBeenCalledTimes(1));
    expect(result.current.submitting).toBe(true);

    unmount();
    pending.reject(new Error('session not found'));
    await act(async () => submit);

    // After unmount the hook must not throw; state updates are skipped.
    expect(saveOutcomeMock).not.toHaveBeenCalled();
  });

  it('maps submit service-unavailable and generic failures distinctly', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock
      .mockRejectedValueOnce(
        new AdaptiveApiError({
          message: 'aborted',
          code: 'request_aborted',
          status: 499,
          retryable: true,
        }),
      )
      .mockRejectedValueOnce(new Error('unexpected submit'));

    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    await act(async () => result.current.handleSubmit());
    expect(result.current.error).toBe('t:exercise.submitUnavailable');
    expect(result.current.submitting).toBe(false);

    await act(async () => result.current.handleSubmit());
    expect(result.current.error).toBe('t:exercise.failedToSubmitAnswer');
    expect(result.current.submitting).toBe(false);
  });

  it('keeps submitting false after a session-not-found submit error', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockRejectedValueOnce(new Error('Session not found'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('B'));
    await act(async () => result.current.handleSubmit());

    expect(result.current.error).toBe('t:exercise.failedToSubmitAnswer');
    expect(result.current.submitting).toBe(false);
    expect(result.current.answerDraft).toEqual({ type: 'mcq', selection: 'B' });
  });

  it('rejects matching order duplicates and missing pairs, and persists valid matches', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    expect(() => result.current.setMatchingOrder(['a', 'a'], ['1', '2'])).toThrow(
      'Duplicate matching item: a',
    );
    expect(() => result.current.setMatchingOrder(['only'], ['x', 'y'])).toThrow(
      'Cannot pair 1 left item(s) with 2 right item(s)',
    );

    act(() => result.current.setMatchingOrder(['L1', 'L2'], ['R1', 'R2']));
    expect(result.current.answerDraft).toEqual({
      type: 'matching',
      matches: { L1: 'R1', L2: 'R2' },
    });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'matching',
      matches: { L1: 'R1', L2: 'R2' },
    });
  });

  it('moves ordering items across every valid boundary and ignores invalid toIndex zero edge cases correctly', async () => {
    getLearningStepMock.mockResolvedValue(
      createStep(
        'concept-a',
        createExercise({
          exercise_type: 'ordering',
          options: {},
          items: ['a', 'b', 'c'],
        }),
      ),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() =>
      expect(result.current.answerDraft).toEqual({ type: 'ordering', items: ['a', 'b', 'c'] }),
    );

    act(() => result.current.moveOrderingItem(2, 0));
    expect(result.current.answerDraft).toEqual({ type: 'ordering', items: ['c', 'a', 'b'] });

    act(() => result.current.moveOrderingItem(0, 0));
    expect(result.current.answerDraft).toEqual({ type: 'ordering', items: ['c', 'a', 'b'] });

    const calls = saveDraftMock.mock.calls.length;
    act(() => result.current.moveOrderingItem(0, -1));
    act(() => result.current.moveOrderingItem(-1, 0));
    act(() => result.current.moveOrderingItem(3, 0));
    act(() => result.current.moveOrderingItem(0, 3));
    expect(saveDraftMock).toHaveBeenCalledTimes(calls);
  });

  it('throws when toggle/move are used on the wrong draft type', async () => {
    getLearningStepMock.mockResolvedValue(
      createStep('concept-a', createExercise({ exercise_type: 'true_false' })),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() =>
      expect(result.current.answerDraft).toEqual({ type: 'true_false', value: null }),
    );

    expect(() => result.current.toggleChoice('A')).toThrow(
      'Cannot toggle a choice outside a multi-correct exercise',
    );
    expect(() => result.current.moveOrderingItem(0, 1)).toThrow(
      'Cannot move an item outside an ordering exercise',
    );

    act(() => {
      result.current.setBooleanAnswer(false);
      result.current.setBlankAnswer('filled');
      result.current.setTextAnswer('short');
      result.current.setOrderingAnswer(['z', 'y']);
    });
    expect(result.current.answerDraft).toEqual({ type: 'ordering', items: ['z', 'y'] });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'true_false',
      value: false,
    });
  });

  it('does not submit while already submitting and resets after success', async () => {
    const pending = deferred<SubmitResult>();
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({} as SubmitResult);
    const router = createRouter();
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router, t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    act(() => {
      void result.current.handleSubmit();
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(submitAnswerMock).toHaveBeenCalledTimes(1));
    expect(result.current.submitting).toBe(true);

    pending.resolve({} as SubmitResult);
    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(router.push).toHaveBeenCalledWith('/adaptive/result/session-a');
  });

  it('allows setShowTheory to toggle independently of load state', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.loadingExercise).toBe(false));
    expect(result.current.showTheory).toBe(false);

    act(() => result.current.setShowTheory(true));
    expect(result.current.showTheory).toBe(true);
    act(() => result.current.setShowTheory(false));
    expect(result.current.showTheory).toBe(false);
  });
});
