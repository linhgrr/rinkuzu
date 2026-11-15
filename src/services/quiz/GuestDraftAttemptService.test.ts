import { describe, expect, it, vi } from 'vitest';

import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import type {
  GuestDraftQuiz,
  IGuestDraftQuizSource,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { GuestDraftAttemptService } from '@/services/quiz/GuestDraftAttemptService';

const DRAFT_TOKEN = 'D'.repeat(43);
const CLAIM_TOKEN = 'C'.repeat(43);
const KEY = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const NOW = new Date('2026-11-10T05:00:00.000Z');
const DRAFT_ID = '6730a0000000000000000001';

const draft: GuestDraftQuiz = {
  id: DRAFT_ID,
  title: 'Cells',
  questions: [
    { id: 'q1', question: 'Q1?', options: ['a', 'b'], type: 'single', correctIndex: 1 },
    {
      id: 'q2',
      question: 'Q2?',
      options: ['a', 'b', 'c'],
      type: 'multiple',
      correctIndexes: [0, 2],
    },
  ],
  complete: true,
  completion: 'full',
};

function setup(found: GuestDraftQuiz | null = draft) {
  const drafts = {
    findReadyByTokenHash: vi.fn(async () => found),
  } satisfies IGuestDraftQuizSource;
  const attempts = {
    recordSubmittedAttempt: vi.fn<IQuizAttemptProgressRepository['recordSubmittedAttempt']>(
      async (data) => ({
        id: 'attempt-1',
        score: data.score,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions,
      }),
    ),
  } satisfies IQuizAttemptProgressRepository;
  const service = new GuestDraftAttemptService(drafts, attempts, () => NOW);
  return { service, drafts, attempts };
}

const submitInput = (answers: (number | number[])[]) => ({
  token: DRAFT_TOKEN,
  guestClaimToken: CLAIM_TOKEN,
  answers,
  idempotencyKey: KEY,
});

describe('GuestDraftAttemptService.play', () => {
  it('serves the questions of a ready draft without correct answers', async () => {
    const { service, drafts } = setup();

    const result = await service.play(DRAFT_TOKEN);

    expect(drafts.findReadyByTokenHash).toHaveBeenCalledWith(hashGuestClaimToken(DRAFT_TOKEN));
    expect(result).toEqual({
      success: true,
      data: {
        title: 'Cells',
        questions: [
          { id: 'q1', question: 'Q1?', options: ['a', 'b'], type: 'single' },
          { id: 'q2', question: 'Q2?', options: ['a', 'b', 'c'], type: 'multiple' },
        ],
        complete: true,
        completion: 'full',
      },
    });
    expect(JSON.stringify(result)).not.toContain('correct');
  });

  it('404s a draft that is unknown or not ready', async () => {
    const { service } = setup(null);
    expect(await service.play(DRAFT_TOKEN)).toMatchObject({ success: false, statusCode: 404 });
  });
});

describe('GuestDraftAttemptService.submit', () => {
  it('scores on the server and stores a guest attempt owned only by the claim hash', async () => {
    const { service, attempts } = setup();

    const result = await service.submit(submitInput([1, [0, 1]]));

    expect(result).toEqual({
      success: true,
      data: { attemptId: 'attempt-1', score: 50, correctAnswers: 1, totalQuestions: 2 },
    });
    const stored = attempts.recordSubmittedAttempt.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      guestClaimTokenHash: hashGuestClaimToken(CLAIM_TOKEN),
      idempotencyKey: KEY,
      quizId: DRAFT_ID,
      quizSlug: `guest-draft-${DRAFT_ID}`,
      quizSnapshot: {
        integrity: 'complete',
        title: 'Cells',
        slug: `guest-draft-${DRAFT_ID}`,
        questions: draft.questions,
      },
      score: 50,
      correctAnswers: 1,
      totalQuestions: 2,
      takenAt: NOW,
    });
    expect(stored).not.toHaveProperty('userId');
    expect(JSON.stringify(stored)).not.toContain(CLAIM_TOKEN);
    expect(JSON.stringify(stored)).not.toContain(DRAFT_TOKEN);
  });

  it('404s a draft that is not ready and stores nothing', async () => {
    const { service, attempts } = setup(null);
    expect(await service.submit(submitInput([1, [0]]))).toMatchObject({
      success: false,
      statusCode: 404,
    });
    expect(attempts.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('400s answers that do not fit the questions', async () => {
    const { service, attempts } = setup();
    // More answers than stored questions (fewer is a played prefix since RIN-1619).
    expect(await service.submit(submitInput([1, [0], 0]))).toMatchObject({
      success: false,
      statusCode: 400,
    });
    expect(attempts.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('409s a reused idempotency key with other answers', async () => {
    const { service, attempts } = setup();
    attempts.recordSubmittedAttempt.mockRejectedValue(new QuizAttemptIdempotencyConflictError());
    expect(await service.submit(submitInput([1, [0]]))).toMatchObject({
      success: false,
      statusCode: 409,
    });
  });

  it('500s an unexpected write failure', async () => {
    const { service, attempts } = setup();
    attempts.recordSubmittedAttempt.mockRejectedValue(new Error('db down'));
    expect(await service.submit(submitInput([1, [0]]))).toMatchObject({
      success: false,
      statusCode: 500,
    });
  });
});

describe('GuestDraftAttemptService first batch and ranges (RIN-1619)', () => {
  /** Ten stored questions; the correct answer of question n is option n % 2. */
  const tenQuestions: GuestDraftQuiz = {
    id: DRAFT_ID,
    title: 'Cells',
    questions: Array.from({ length: 10 }, (_, index) => ({
      id: `q${index + 1}`,
      question: `Q${index + 1}?`,
      options: ['a', 'b'],
      type: 'single' as const,
      correctIndex: index % 2,
    })),
    complete: true,
    completion: 'full',
  };
  const allCorrect = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => (from + index) % 2);

  it('serves the first batch of an incomplete draft and says it is incomplete', async () => {
    const firstBatch = { ...tenQuestions, questions: tenQuestions.questions.slice(0, 5) };
    const { service } = setup({ ...firstBatch, complete: false, completion: null });

    const result = await service.play(DRAFT_TOKEN);

    expect(result).toMatchObject({ success: true, data: { complete: false, completion: null } });
    expect(result.success && result.data.questions).toHaveLength(5);
  });

  it('scores 5 answers on 10 stored questions over the 5 shown, never the unseen ones', async () => {
    const { service, attempts } = setup(tenQuestions);

    const result = await service.submit(submitInput(allCorrect(0, 5)));

    expect(result).toMatchObject({
      success: true,
      data: { score: 100, correctAnswers: 5, totalQuestions: 5 },
    });
    const stored = attempts.recordSubmittedAttempt.mock.calls[0]?.[0];
    expect(stored?.quizSnapshot.questions).toEqual(tenQuestions.questions.slice(0, 5));
    expect(stored?.wrongQuestions).toEqual([]);
  });

  it('scores attempt 1 over {0,5} and attempt 2 over {5,5}, 5 questions each', async () => {
    const { service, attempts } = setup(tenQuestions);

    const first = await service.submit({
      ...submitInput(allCorrect(0, 5)),
      questionRange: { from: 0, count: 5 },
    });
    const second = await service.submit({
      ...submitInput([...allCorrect(5, 4), 0]),
      idempotencyKey: '9b2f1c4e-1d7a-4a43-8c55-2f0b7e1d3a10',
      questionRange: { from: 5, count: 5 },
    });

    expect(first).toMatchObject({ success: true, data: { totalQuestions: 5, score: 100 } });
    expect(second).toMatchObject({
      success: true,
      data: { totalQuestions: 5, correctAnswers: 4, score: 80 },
    });
    const secondStored = attempts.recordSubmittedAttempt.mock.calls[1]?.[0];
    expect(secondStored?.quizSnapshot.questions).toEqual(tenQuestions.questions.slice(5, 10));
    expect(secondStored?.wrongQuestions.map((wrong) => wrong.questionId)).toEqual(['q10']);
  });

  it.each([
    { from: 6, count: 5 },
    { from: -1, count: 2 },
    { from: 0, count: 0 },
    { from: 1.5, count: 2 },
    { from: 0, count: 11 },
  ])('400s the range %j and stores nothing', async (questionRange) => {
    const { service, attempts } = setup(tenQuestions);

    const result = await service.submit({ ...submitInput(allCorrect(0, 5)), questionRange });

    expect(result).toEqual({ success: false, error: 'Invalid question range', statusCode: 400 });
    expect(attempts.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('400s answers that do not match the range count', async () => {
    const { service, attempts } = setup(tenQuestions);
    const result = await service.submit({
      ...submitInput(allCorrect(0, 4)),
      questionRange: { from: 0, count: 5 },
    });
    expect(result).toMatchObject({ success: false, statusCode: 400 });
    expect(attempts.recordSubmittedAttempt).not.toHaveBeenCalled();
  });
});
