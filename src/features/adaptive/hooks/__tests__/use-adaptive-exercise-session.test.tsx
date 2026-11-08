/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { getLearningStep, submitAnswer } from '@/features/adaptive/lib/adaptive-api-methods';
import type { Exercise } from '@/features/adaptive/types/learning';
import {
  clearSessionExerciseDraft,
  getSessionExerciseDraft,
  saveSessionExerciseDraft,
  saveSessionExerciseOutcome,
} from '../../lib/session-storage';
import { useAdaptiveExerciseSession } from '../use-adaptive-exercise-session';

vi.mock('@/features/adaptive/lib/adaptive-api-methods', () => ({
  getLearningStep: vi.fn(),
  submitAnswer: vi.fn(),
}));

vi.mock('../../lib/session-storage', () => ({
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
      bloom_label: 'Remember',
      step: 0,
      max_steps: 5,
    },
    theory: null,
    exercise,
    cache_status: 'created',
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

const t = (key: string) => key;

beforeEach(() => {
  vi.clearAllMocks();
  getDraftMock.mockReturnValue(null);
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn().mockReturnValueOnce('submit-key-1').mockReturnValueOnce('submit-key-2'),
  });
});

describe('useAdaptiveExerciseSession', () => {
  it('loads the latest session when an older request resolves out of order', async () => {
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
    await waitFor(() =>
      expect(result.current.concept).toEqual(
        expect.objectContaining({ concept_name: 'concept-b' }),
      ),
    );

    first.resolve(createStep('concept-a'));
    await act(async () => first.promise);
    expect(result.current.concept).toEqual(expect.objectContaining({ concept_name: 'concept-b' }));
    expect(result.current.loadingExercise).toBe(false);
  });

  it('maps service failures to an actionable load error', async () => {
    getLearningStepMock.mockRejectedValueOnce(
      new AdaptiveApiError({
        message: 'offline',
        code: 'service_unavailable',
        status: 503,
        retryable: true,
      }),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );

    await waitFor(() => expect(result.current.error).toBe('exercise.serviceUnavailable'));
  });

  it('exposes the complete loaded state, restored draft, and navigation prefetches', async () => {
    const restoredDraft = { type: 'mcq', selection: 'B' } as const;
    const exercise = createExercise();
    getDraftMock.mockReturnValueOnce(restoredDraft);
    getLearningStepMock.mockResolvedValueOnce({
      ...createStep('concept-a', exercise),
      theory: {
        content: 'Theory',
        examples: [],
      },
    });
    const router = createRouter();
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router, t }),
    );

    await waitFor(() => expect(result.current.concept?.concept_name).toBe('concept-a'));
    expect(result.current).toMatchObject({
      concept: expect.objectContaining({ concept_name: 'concept-a' }),
      theory: expect.objectContaining({ content: 'Theory' }),
      exercise,
      answerDraft: restoredDraft,
      loadingConcept: false,
      loadingTheory: false,
      loadingExercise: false,
      submitting: false,
      error: null,
      showTheory: true,
    });
    expect(getDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1');
    expect(router.prefetch).toHaveBeenCalledWith('/adaptive');
    expect(router.prefetch).toHaveBeenCalledWith('/adaptive/result/session-a');
  });

  it('maps missing and generic sessions without leaving a loading state', async () => {
    getLearningStepMock
      .mockRejectedValueOnce(new Error('session_not_found'))
      .mockRejectedValueOnce(new Error('unexpected'));
    const router = createRouter();
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAdaptiveExerciseSession({ sessionId, router, t }),
      { initialProps: { sessionId: 'missing-session' } },
    );

    await waitFor(() => expect(result.current.error).toBe('exercise.failedToLoadExercise'));
    expect(result.current).toMatchObject({
      loadingConcept: false,
      loadingTheory: false,
      loadingExercise: false,
    });

    rerender({ sessionId: 'broken-session' });
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBe('exercise.failedToLoadExercise'));
    expect(result.current.loadingExercise).toBe(false);
  });

  it('lowers both loading flags when the load rejects and loads again on retry (RIN-1193)', async () => {
    const first = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    getLearningStepMock
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(createStep('after-retry'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-r', router: createRouter(), t }),
    );
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({ loadingConcept: true, loadingExercise: true });

    first.reject(new AdaptiveApiError({ message: 'down', code: 'service_unavailable' }));
    await waitFor(() => expect(result.current.error).toBe('exercise.serviceUnavailable'));
    expect(result.current).toMatchObject({ loadingConcept: false, loadingExercise: false });

    await act(async () => result.current.loadData());
    expect(result.current.concept?.concept_name).toBe('after-retry');
    expect(result.current).toMatchObject({
      error: null,
      loadingConcept: false,
      loadingExercise: false,
    });
  });

  it('leaves the loading flags to the newer session when a superseded load rejects (RIN-1193)', async () => {
    const older = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    const newer = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    getLearningStepMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAdaptiveExerciseSession({ sessionId, router: createRouter(), t }),
      { initialProps: { sessionId: 'session-old' } },
    );
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(1));
    rerender({ sessionId: 'session-new' });
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(2));

    await act(async () => older.reject(new Error('stale')));
    expect(result.current).toMatchObject({
      error: null,
      loadingConcept: true,
      loadingExercise: true,
    });

    await act(async () => newer.resolve(createStep('newer')));
    expect(result.current.concept?.concept_name).toBe('newer');
    expect(result.current.loadingExercise).toBe(false);
  });

  it('deduplicates an in-flight load and releases the lock for an explicit retry', async () => {
    const first = deferred<Awaited<ReturnType<typeof getLearningStep>>>();
    getLearningStepMock
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(createStep('retry'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(getLearningStepMock).toHaveBeenCalledTimes(1));

    await act(async () => result.current.loadData());
    expect(getLearningStepMock).toHaveBeenCalledTimes(1);

    first.reject(new Error('temporary'));
    await waitFor(() => expect(result.current.loadingExercise).toBe(false));
    await act(async () => result.current.loadData());
    await waitFor(() => expect(result.current.concept?.concept_name).toBe('retry'));
    expect(getLearningStepMock).toHaveBeenCalledTimes(2);
  });

  it('reuses an idempotency key for a retry but rotates it after the answer changes', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof submitAnswer>>);
    const router = createRouter();
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router, t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    act(() => result.current.selectChoice('A'));
    await act(async () => result.current.handleSubmit());
    expect(submitAnswerMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ idempotency_key: 'submit-key-1', answer: { choice: 'A' } }),
    );

    act(() => result.current.selectChoice('B'));
    await act(async () => result.current.handleSubmit());
    expect(submitAnswerMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ idempotency_key: 'submit-key-2', answer: { choice: 'B' } }),
    );
    expect(saveOutcomeMock).toHaveBeenCalledTimes(1);
    expect(clearDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1');
    expect(router.push).toHaveBeenCalledWith('/adaptive/result/session-a');
  });

  it('prevents duplicate submissions while the first request is in flight', async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitAnswer>>>();
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    act(() => {
      void result.current.handleSubmit();
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(submitAnswerMock).toHaveBeenCalledTimes(1));

    pending.resolve({} as Awaited<ReturnType<typeof submitAnswer>>);
    await waitFor(() => expect(result.current.submitting).toBe(false));
  });

  it('maps a missing session during submit and leaves the answer retryable', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockRejectedValueOnce(new Error('Session not found'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    await act(async () => result.current.handleSubmit());

    expect(result.current.submitError).toBe('exercise.failedToSubmitAnswer');
    expect(result.current.submitting).toBe(false);
    expect(result.current.answerDraft).toEqual({ type: 'mcq', selection: 'A' });
    expect(saveOutcomeMock).not.toHaveBeenCalled();
  });

  it('keeps the question on screen after a submit failure and clears the banner on edit (RIN-1011)', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockRejectedValueOnce(new Error('upstream 503'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));

    await act(async () => result.current.handleSubmit());

    expect(result.current.error).toBeNull();
    expect(result.current.exercise).not.toBeNull();
    expect(result.current.concept).not.toBeNull();
    expect(result.current.submitError).toBe('exercise.failedToSubmitAnswer');

    act(() => result.current.selectChoice('B'));
    expect(result.current.submitError).toBeNull();
  });

  it('does not publish a completed submit after unmount', async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitAnswer>>>();
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockReturnValueOnce(pending.promise);
    const router = createRouter();
    const { result, unmount } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router, t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());
    act(() => result.current.selectChoice('A'));
    let submit!: Promise<void>;
    act(() => {
      submit = result.current.handleSubmit();
    });
    await waitFor(() => expect(submitAnswerMock).toHaveBeenCalledTimes(1));

    unmount();
    pending.resolve({} as Awaited<ReturnType<typeof submitAnswer>>);
    await act(async () => submit);

    expect(saveOutcomeMock).not.toHaveBeenCalled();
    expect(clearDraftMock).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('persists answer edits against the loaded exercise', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    act(() => result.current.selectChoice('B'));

    expect(result.current.answerDraft).toEqual({ type: 'mcq', selection: 'B' });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'mcq',
      selection: 'B',
    });
  });

  it('toggles multi-correct choices deterministically and persists each change', async () => {
    getLearningStepMock.mockResolvedValue(
      createStep('concept-a', createExercise({ exercise_type: 'multi_correct' })),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() =>
      expect(result.current.answerDraft).toEqual({ type: 'multi_correct', selections: [] }),
    );

    act(() => {
      result.current.toggleChoice('B');
      result.current.toggleChoice('A');
    });
    expect(result.current.answerDraft).toEqual({
      type: 'multi_correct',
      selections: ['A', 'B'],
    });

    act(() => result.current.toggleChoice('B'));
    expect(result.current.answerDraft).toEqual({ type: 'multi_correct', selections: ['A'] });
    expect(saveDraftMock).toHaveBeenLastCalledWith('session-a', 'exercise-1', {
      type: 'multi_correct',
      selections: ['A'],
    });
  });

  it('moves ordering items and ignores indexes outside the exercise', async () => {
    getLearningStepMock.mockResolvedValue(
      createStep(
        'concept-a',
        createExercise({
          exercise_type: 'ordering',
          options: {},
          items: ['first', 'second', 'third'],
        }),
      ),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() =>
      expect(result.current.answerDraft).toEqual({
        type: 'ordering',
        items: ['first', 'second', 'third'],
      }),
    );

    act(() => result.current.moveOrderingItem(0, 2));
    expect(result.current.answerDraft).toEqual({
      type: 'ordering',
      items: ['second', 'third', 'first'],
    });

    const callsAfterMove = saveDraftMock.mock.calls.length;
    act(() => result.current.moveOrderingItem(-1, 20));
    expect(saveDraftMock).toHaveBeenCalledTimes(callsAfterMove);
  });

  it('rejects answer operations for the wrong draft type and every invalid ordering boundary', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    expect(() => result.current.toggleChoice('A')).toThrow(
      'Cannot toggle a choice outside a multi-correct exercise',
    );
    expect(() => result.current.moveOrderingItem(0, 1)).toThrow(
      'Cannot move an item outside an ordering exercise',
    );

    act(() => result.current.setOrderingAnswer(['first', 'second', 'third']));
    const callsBeforeInvalidMoves = saveDraftMock.mock.calls.length;
    const invalidMoves: Array<readonly [number, number]> = [
      [-1, 0],
      [0, -1],
      [3, 0],
      [0, 3],
    ];
    for (const [fromIndex, toIndex] of invalidMoves) {
      act(() => result.current.moveOrderingItem(fromIndex, toIndex));
    }
    expect(saveDraftMock).toHaveBeenCalledTimes(callsBeforeInvalidMoves);
    expect(result.current.answerDraft).toEqual({
      type: 'ordering',
      items: ['first', 'second', 'third'],
    });
  });

  it('validates matching cardinality and persists all direct answer shapes', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    expect(() => result.current.setMatchingOrder(['left'], [])).toThrow(
      'Cannot pair 1 left item(s) with 0 right item(s)',
    );

    act(() => {
      result.current.setBooleanAnswer(true);
      result.current.setBlankAnswer('blank');
      result.current.setTextAnswer('short');
      result.current.setMatchingOrder(['left-a', 'left-b'], ['right-a', 'right-b']);
      result.current.setOrderingAnswer(['second', 'first']);
    });

    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'true_false',
      value: true,
    });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'fill_blank',
      values: ['blank'],
    });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'short_answer',
      text: 'short',
    });
    expect(saveDraftMock).toHaveBeenCalledWith('session-a', 'exercise-1', {
      type: 'matching',
      matches: { 'left-a': 'right-a', 'left-b': 'right-b' },
    });
    expect(result.current.answerDraft).toEqual({
      type: 'ordering',
      items: ['second', 'first'],
    });
  });

  it('does not submit an incomplete answer and maps submit availability failures', async () => {
    getLearningStepMock.mockResolvedValue(createStep('concept-a'));
    submitAnswerMock.mockRejectedValueOnce(
      new AdaptiveApiError({
        message: 'offline',
        code: 'upstream_timeout',
        status: 504,
        retryable: true,
      }),
    );
    const { result } = renderHook(() =>
      useAdaptiveExerciseSession({ sessionId: 'session-a', router: createRouter(), t }),
    );
    await waitFor(() => expect(result.current.exercise).not.toBeNull());

    await act(async () => result.current.handleSubmit());
    expect(submitAnswerMock).not.toHaveBeenCalled();

    act(() => result.current.selectChoice('A'));
    await act(async () => result.current.handleSubmit());
    expect(result.current.submitError).toBe('exercise.submitUnavailable');
    expect(result.current.submitting).toBe(false);
  });
});
