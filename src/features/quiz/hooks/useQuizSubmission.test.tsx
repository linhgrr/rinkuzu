// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizSubmission } from '@/features/quiz/hooks/useQuizSubmission';
import { submitQuizAttemptViewModel } from '@/features/quiz/api/quiz-interaction-api';
import { findGuestClaimToken } from '@/features/quiz/lib/guest-claims';

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

function renderSubmissionHook(userAnswers: Array<number | number[]> = [1], sessionEmail?: string) {
  const onSubmitSuccess = vi.fn();
  const onSubmitError = vi.fn();
  const hook = renderHook(
    ({ answers }) =>
      useQuizSubmission({
        slug: 'architecture',
        quiz: { questions: [{ type: 'single' }] },
        userAnswers: answers,
        ...(sessionEmail ? { sessionEmail } : {}),
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
    window.localStorage.clear();
    vi.stubGlobal('crypto', {
      randomUUID,
      getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses an idempotency key for an unchanged retry', async () => {
    const temporary = new Error('temporary');
    submitAttemptMock.mockRejectedValueOnce(temporary).mockResolvedValueOnce({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const { result, onSubmitError, onSubmitSuccess } = renderSubmissionHook();

    await act(async () => expect(await result.current.completeSubmit()).toBe(false));
    // A rejected request releases the pending flag so the learner can retry.
    expect(result.current.submitting).toBe(false);
    await act(async () => expect(await result.current.completeSubmit()).toBe(true));
    expect(result.current.submitting).toBe(false);

    expect(submitAttemptMock.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    ]);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(onSubmitError).toHaveBeenCalledWith(temporary);
    expect(onSubmitSuccess).toHaveBeenCalledWith('attempt-1', 100);
  });

  it('sends a guest claim token, no email, reuses it on retry and stores it (RIN-912)', async () => {
    submitAttemptMock.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const { result } = renderSubmissionHook();

    await act(async () => expect(await result.current.completeSubmit()).toBe(false));
    await act(async () => expect(await result.current.completeSubmit()).toBe(true));

    const inputs = submitAttemptMock.mock.calls.map(([input]) => input);
    expect(inputs[0]?.guestClaimToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inputs[1]?.guestClaimToken).toBe(inputs[0]?.guestClaimToken);
    expect(inputs.every((input) => !('userEmail' in input))).toBe(true);
    expect(findGuestClaimToken('attempt-1')).toBe(inputs[0]?.guestClaimToken);
  });

  it('sends no guest claim token for a signed-in learner', async () => {
    submitAttemptMock.mockResolvedValueOnce({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const { result } = renderSubmissionHook([1], 'learner@example.com');

    await act(async () => expect(await result.current.completeSubmit()).toBe(true));

    expect(submitAttemptMock.mock.calls[0]?.[0]).not.toHaveProperty('guestClaimToken');
    expect(findGuestClaimToken('attempt-1')).toBeNull();
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

  it('waits for async success cleanup before resolving submission', async () => {
    const cleanup = deferred<void>();
    submitAttemptMock.mockResolvedValueOnce({
      attemptId: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const { result } = renderHook(
      ({ onSubmitSuccess }) =>
        useQuizSubmission({
          slug: 'architecture',
          quiz: { questions: [{ type: 'single' }] },
          userAnswers: [1],
          onSubmitSuccess,
          onSubmitError: vi.fn(),
          mapAnswersToOriginalOrder: (_quiz, answers) => answers,
          isQuestionAnswered: (_question, answer) => answer !== -1,
        }),
      { initialProps: { onSubmitSuccess: vi.fn(() => cleanup.promise) } },
    );

    let submission!: Promise<boolean>;
    await act(async () => {
      submission = result.current.completeSubmit();
      await Promise.resolve();
    });
    expect(submission).toBeInstanceOf(Promise);

    let settled = false;
    void submission.then(() => {
      settled = true;
    });
    await act(async () => Promise.resolve());
    expect(settled).toBe(false);

    cleanup.resolve();
    await act(async () => expect(await submission).toBe(true));
    expect(settled).toBe(true);
  });
});
