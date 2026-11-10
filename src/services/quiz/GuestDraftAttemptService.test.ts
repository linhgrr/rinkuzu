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
    expect(await service.submit(submitInput([1]))).toMatchObject({
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
