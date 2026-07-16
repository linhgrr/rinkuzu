// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizSubmission } from '@/features/quiz/hooks/useQuizSubmission';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';

vi.mock('@/features/quiz/api/quiz-interaction-api', () => ({
  submitQuizAttemptViewModel: vi.fn(),
}));

const submitAttemptMock = vi.mocked(submitQuizAttemptViewModel);
const randomUUID = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderSubmissionHook(userAnswers: Array<number | number[]> = [1]) {
  const onSubmitSuccess = vi.fn();
  const onSubmitError = vi.fn();
  const hook = renderHook(
    ({ answers }) =>
      useQuizSubmission({
        slug: 'architecture',
        quiz: { questions: [{ type: 'single' }] },
        userAnswers: answers,
        userEmail: 'guest@example.com',
        onSubmitSuccess,
        onSubmitError,
        mapAnswersToOriginalOrder: (_quiz, mappedAnswers) => mappedAnswers,
        isQuestionAnswered: (_question, answer) => answer !== -1,
      }),
    { initialProps: { answers: userAnswers } },
  );
  return { ...hook, onSubmitError, onSubmitSuccess };
}

describe('useQuizSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUID.mockReturnValueOnce('018f7494-8bd8-7b8a-a387-3bc5a14f22a1');
    vi.stubGlobal('crypto', { randomUUID });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses an idempotency key for an unchanged retry', async () => {
    submitAttemptMock.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const { result, onSubmitError, onSubmitSuccess } = renderSubmissionHook();

    await act(async () => expect(await result.current.completeSubmit()).toBe(false));
    await act(async () => expect(await result.current.completeSubmit()).toBe(true));

    expect(submitAttemptMock.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    ]);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(onSubmitError).toHaveBeenCalledWith('temporary');
    expect(onSubmitSuccess).toHaveBeenCalledWith('attempt-1', 100);
  });

  it('blocks a second submission while the first request is in flight', async () => {
    const pending = deferred<Awaited<ReturnType<typeof submitQuizAttemptViewModel>>>();
    submitAttemptMock.mockReturnValueOnce(pending.promise);
    const { result } = renderSubmissionHook();

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.completeSubmit();
      second = result.current.completeSubmit();
    });
    await expect(second).resolves.toBe(false);
    expect(submitAttemptMock).toHaveBeenCalledOnce();

    pending.resolve({ attemptId: 'attempt-1', score: 100, correctAnswers: 1, totalQuestions: 1 });
    await act(async () => expect(await first).toBe(true));
  });
});
