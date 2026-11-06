import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

import {
  addQuizDiscussionCommentViewModel,
  deleteSavedQuizProgress,
  fetchQuizDiscussionViewModels,
  loadSavedQuizProgress,
  reportQuizViewModel,
  saveQuizProgress,
  submitQuizAttemptViewModel,
} from '@/features/quiz/api/quiz-interaction-api';

describe('quiz-interaction-api', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
  });

  it('submits attempts with encoded slugs and optional user email', async () => {
    fetchApiDataMock.mockResolvedValue({
      score: 80,
      correctAnswers: 4,
      totalQuestions: 5,
      attemptId: 'attempt-1',
    });

    await expect(
      submitQuizAttemptViewModel({
        slug: 'linear algebra',
        answers: [0, [1, 2]],
        idempotencyKey: 'idem-1',
        guestClaimToken: 'T'.repeat(43),
      }),
    ).resolves.toEqual({
      score: 80,
      correctAnswers: 4,
      totalQuestions: 5,
      attemptId: 'attempt-1',
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/quiz/linear%20algebra/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: [0, [1, 2]],
        idempotencyKey: 'idem-1',
        guestClaimToken: 'T'.repeat(43),
      }),
    });

    fetchApiDataMock.mockResolvedValueOnce({
      score: 0,
      correctAnswers: 0,
      totalQuestions: 1,
      attemptId: 'attempt-2',
    });
    await submitQuizAttemptViewModel({
      slug: 'quiz',
      answers: [1],
      idempotencyKey: 'idem-2',
      guestClaimToken: '',
    });
    expect(JSON.parse(fetchApiDataMock.mock.calls.at(-1)?.[1].body as string)).toEqual({
      answers: [1],
      idempotencyKey: 'idem-2',
    });
  });

  it('sends a guest claim token and no email for a signed-out submit (RIN-912)', async () => {
    fetchApiDataMock.mockResolvedValueOnce({
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
      attemptId: 'attempt-3',
    });
    await submitQuizAttemptViewModel({
      slug: 'quiz',
      answers: [1],
      idempotencyKey: 'idem-3',
      guestClaimToken: 'fake-token',
    });
    expect(JSON.parse(fetchApiDataMock.mock.calls.at(-1)?.[1].body as string)).toEqual({
      answers: [1],
      idempotencyKey: 'idem-3',
      guestClaimToken: 'fake-token',
    });
  });

  it('sends retryOfAttemptId for a retry-missed session (RIN-917)', async () => {
    fetchApiDataMock.mockResolvedValueOnce({
      score: 50,
      correctAnswers: 1,
      totalQuestions: 2,
      attemptId: 'attempt-3',
    });
    await submitQuizAttemptViewModel({
      slug: 'quiz',
      answers: [1, 0],
      idempotencyKey: 'idem-3',
      retryOfAttemptId: '6a8ed20a3d0a1892cacdfe0b',
    });
    expect(JSON.parse(fetchApiDataMock.mock.calls.at(-1)?.[1].body as string)).toEqual({
      answers: [1, 0],
      idempotencyKey: 'idem-3',
      retryOfAttemptId: '6a8ed20a3d0a1892cacdfe0b',
    });
  });

  it('loads, saves, and deletes saved progress through the progress route', async () => {
    fetchApiDataMock.mockResolvedValueOnce({
      progress: {
        questionOrder: [0, 1],
        optionOrders: [
          [0, 1],
          [1, 0],
        ],
        userAnswers: [0, []],
        currentQuestionIndex: 1,
        answeredCount: 1,
        totalQuestions: 2,
      },
    });
    await expect(loadSavedQuizProgress('quiz a')).resolves.toEqual({
      questionOrder: [0, 1],
      optionOrders: [
        [0, 1],
        [1, 0],
      ],
      userAnswers: [0, []],
      currentQuestionIndex: 1,
      answeredCount: 1,
      totalQuestions: 2,
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/quiz/quiz%20a/progress');

    fetchApiDataMock.mockResolvedValueOnce({ progress: null });
    await expect(loadSavedQuizProgress('quiz')).resolves.toBeNull();

    const progress = {
      questionOrder: [0],
      optionOrders: [[0, 1]],
      userAnswers: [1],
      currentQuestionIndex: 0,
      answeredCount: 1,
      totalQuestions: 1,
    };
    fetchApiDataMock.mockResolvedValueOnce({ saved: true });
    await expect(saveQuizProgress('quiz', progress)).resolves.toEqual({ saved: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/quiz/quiz/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
      keepalive: true,
    });

    const controller = new AbortController();
    fetchApiDataMock.mockResolvedValueOnce({ saved: true });
    await expect(
      saveQuizProgress('quiz', progress, { signal: controller.signal }),
    ).resolves.toEqual({ saved: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/quiz/quiz/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
      signal: controller.signal,
    });

    fetchApiDataMock.mockResolvedValueOnce({ deleted: true });
    await expect(deleteSavedQuizProgress('quiz')).resolves.toEqual({ deleted: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/quiz/quiz/progress', {
      method: 'DELETE',
    });
  });

  it('maps discussions and reports through encoded slug routes', async () => {
    fetchApiDataMock.mockResolvedValueOnce([
      {
        id: 'd1',
        questionIndex: 0,
        comments: [
          {
            id: 'c1',
            author: 'A',
            content: 'Hello',
            isEdited: false,
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T01:00:00.000Z',
          },
        ],
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T01:00:00.000Z',
      },
    ]);
    await expect(fetchQuizDiscussionViewModels('quiz b')).resolves.toEqual([
      expect.objectContaining({
        id: 'd1',
        comments: [expect.objectContaining({ id: 'c1', updatedAt: '2026-07-01T01:00:00.000Z' })],
      }),
    ]);
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/quiz/quiz%20b/discussions');

    fetchApiDataMock.mockResolvedValueOnce({
      id: 'd2',
      questionIndex: 1,
      comments: [
        {
          id: 'c2',
          author: 'B',
          content: 'New',
          isEdited: false,
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    });
    await expect(
      addQuizDiscussionCommentViewModel({
        slug: 'quiz',
        questionIndex: 1,
        content: 'New',
      }),
    ).resolves.toMatchObject({ id: 'd2', questionIndex: 1 });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/quiz/quiz/discussions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: 1, content: 'New' }),
    });

    fetchApiDataMock.mockResolvedValueOnce({ reported: true });
    await expect(
      reportQuizViewModel('quiz c', '507f1f77bcf86cd799439011', 'broken'),
    ).resolves.toEqual({ reported: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/quiz/quiz%20c/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: '507f1f77bcf86cd799439011',
        content: 'broken',
      }),
    });
  });
});
