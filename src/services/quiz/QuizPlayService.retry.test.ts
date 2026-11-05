import { describe, expect, it, vi, type Mocked } from 'vitest';
import type { Session } from 'next-auth';
import type { Attempt } from '@/entities/Attempt';
import type { Quiz, QuizQuestion } from '@/entities/Quiz';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { QuizPlayService } from '@/services/quiz/QuizPlayService';
import { assertFail, assertOk } from '../../../tests/helpers/service-result-assert';

const quizId = '507f191e810c19729de860ea';
const learnerId = '507f191e810c19729de860eb';
const sourceAttemptId = '507f191e810c19729de860ec';
const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';

function single(id: string, correctIndex: number): QuizQuestion {
  return {
    id,
    question: `Question ${id}?`,
    options: ['a', 'b', 'c'],
    type: 'single',
    correctIndex,
  };
}

const questions: QuizQuestion[] = [
  single('q0', 0),
  single('q1', 1),
  {
    id: 'q2',
    question: 'Pick two',
    options: ['a', 'b', 'c'],
    type: 'multiple',
    correctIndexes: [0, 2],
  },
  single('q3', 2),
];

const quiz: Quiz = {
  id: quizId,
  title: 'Fake quiz',
  slug: 'fake-quiz',
  author: '507f191e810c19729de860ff',
  visibility: 'public',
  questions,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

/** Source attempt: q0 right, q1 wrong, q2 wrong (partial), q3 unanswered. */
function sourceAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: sourceAttemptId,
    user: learnerId,
    quiz: { id: quizId, title: quiz.title, slug: quiz.slug, questions },
    answers: [0, 0, [0], -1],
    score: 25,
    totalQuestions: 4,
    takenAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

const learnerSession: Session = {
  user: { id: learnerId, email: 'learner@example.test', role: 'user' },
  expires: '2026-12-01T00:00:00.000Z',
};

function createService(source: Attempt | null = sourceAttempt()) {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue(quiz),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn().mockResolvedValue(quiz),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };
  // Never reached on the retry paths under test.
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
  };
  const progressRepository: Mocked<IQuizProgressRepository> = {
    findByUserAndQuiz: vi.fn(),
    upsert: vi.fn(),
    deleteByUserAndQuiz: vi.fn(),
  };
  const attemptRepository = {
    findByIdWithQuiz: vi.fn<IAttemptRepository['findByIdWithQuiz']>().mockResolvedValue(source),
  };
  const attemptProgressRepository = {
    recordSubmittedAttempt: vi
      .fn<IQuizAttemptProgressRepository['recordSubmittedAttempt']>()
      .mockImplementation(async (data) => ({
        id: 'retry-attempt',
        score: data.score,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions,
      })),
  };
  const service = new QuizPlayService(
    quizRepository,
    userRepository,
    progressRepository,
    attemptProgressRepository,
    attemptRepository,
  );
  return { service, quizRepository, attemptRepository, attemptProgressRepository };
}

describe('QuizPlayService retry-missed session', () => {
  it('returns only the missed questions, in original order, with their quiz indices', async () => {
    const { service, attemptRepository } = createService();

    const result = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, learnerId);

    assertOk(result);
    expect(result.data.questions.map((question) => question.id)).toEqual(['q1', 'q2', 'q3']);
    expect(result.data.questionCount).toBe(3);
    expect(result.data.retry).toEqual({ ofAttemptId: sourceAttemptId, questionIndices: [1, 2, 3] });
    expect(result.data.questions[0]).not.toHaveProperty('correctIndex');
    expect(attemptRepository.findByIdWithQuiz).toHaveBeenCalledWith(sourceAttemptId, {
      userId: learnerId,
    });
  });

  it('requires a signed-in learner (guest gets 401)', async () => {
    const { service, attemptRepository } = createService();

    const result = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, undefined);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 401 });
    expect(attemptRepository.findByIdWithQuiz).not.toHaveBeenCalled();
  });

  it("404s when the attempt is not the learner's (owner-scoped lookup finds nothing)", async () => {
    const { service } = createService(null);

    const result = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, learnerId);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 404 });
  });

  it('404s when the attempt belongs to another quiz or the id is malformed', async () => {
    const otherQuiz = sourceAttempt({
      quiz: { id: '507f191e810c19729de86000', title: 'Other', slug: 'other', questions },
    });
    const { service, attemptRepository } = createService(otherQuiz);

    const wrongQuiz = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, learnerId);
    const malformed = await service.getRetryQuizForPlay('fake-quiz', 'not-an-id', learnerId);

    expect(wrongQuiz).toMatchObject({ success: false, statusCode: 404 });
    expect(malformed).toMatchObject({ success: false, statusCode: 404 });
    expect(attemptRepository.findByIdWithQuiz).toHaveBeenCalledTimes(1);
  });

  it('409 nothing_to_retry when every question was right', async () => {
    const { service } = createService(sourceAttempt({ answers: [0, 1, [2, 0], 2], score: 100 }));

    const result = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, learnerId);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 409, code: 'nothing_to_retry' });
  });

  it('drops a missed question that was deleted from the quiz since the attempt', async () => {
    const { service, quizRepository } = createService();
    const edited = {
      ...quiz,
      questions: [questions[0], questions[3], questions[1]] as QuizQuestion[],
    };
    quizRepository.findBySlug.mockResolvedValue(edited);

    const result = await service.getRetryQuizForPlay('fake-quiz', sourceAttemptId, learnerId);

    assertOk(result);
    expect(result.data.retry?.questionIndices).toEqual([1, 2]);
    expect(result.data.questions.map((question) => question.id)).toEqual(['q3', 'q1']);
  });
});

describe('QuizPlayService retry-missed submit', () => {
  it('scores over the server-derived subset and stores a normal attempt with the mapping', async () => {
    const { service, attemptProgressRepository } = createService();

    // q1 now right, q2 still wrong, q3 now right.
    const result = await service.submitQuizAttempt(
      'fake-quiz',
      [1, [0], 2],
      idempotencyKey,
      learnerSession,
      undefined,
      sourceAttemptId,
    );

    assertOk(result);
    expect(result.data).toMatchObject({ score: 67, correctAnswers: 2, totalQuestions: 3 });
    const stored = attemptProgressRepository.recordSubmittedAttempt.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      userId: learnerId,
      idempotencyKey,
      quizId,
      retryOfAttemptId: sourceAttemptId,
      questionIndices: [1, 2, 3],
      totalQuestions: 3,
      correctAnswers: 2,
      answers: [1, [0], 2],
    });
    expect(stored?.quizSnapshot.questions.map((question) => question.id)).toEqual([
      'q1',
      'q2',
      'q3',
    ]);
    expect(stored?.wrongQuestions.map((wrong) => wrong.questionId)).toEqual(['q2']);
  });

  it('rejects a full-quiz answer list: the client cannot widen the set', async () => {
    const { service, attemptProgressRepository } = createService();

    const result = await service.submitQuizAttempt(
      'fake-quiz',
      [0, 1, [0, 2], 2],
      idempotencyKey,
      learnerSession,
      undefined,
      sourceAttemptId,
    );

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 400 });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('refuses retry submits from guests and for attempts the learner does not own', async () => {
    const { service, attemptProgressRepository } = createService(null);

    const guest = await service.submitQuizAttempt(
      'fake-quiz',
      [1, [0], 2],
      idempotencyKey,
      null,
      'guest@example.test',
      sourceAttemptId,
    );
    const notOwner = await service.submitQuizAttempt(
      'fake-quiz',
      [1, [0], 2],
      idempotencyKey,
      learnerSession,
      undefined,
      sourceAttemptId,
    );

    expect(guest).toMatchObject({ success: false, statusCode: 401 });
    expect(notOwner).toMatchObject({ success: false, statusCode: 404 });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('passes the same idempotency key and payload on a resubmit (repository dedupes)', async () => {
    const { service, attemptProgressRepository } = createService();
    const submit = () =>
      service.submitQuizAttempt(
        'fake-quiz',
        [1, [0], 2],
        idempotencyKey,
        learnerSession,
        undefined,
        sourceAttemptId,
      );

    const [first, second] = [await submit(), await submit()];

    assertOk(first);
    assertOk(second);
    const [call1, call2] = attemptProgressRepository.recordSubmittedAttempt.mock.calls;
    expect(call1?.[0]).toEqual({ ...call2?.[0], takenAt: call1?.[0].takenAt });
  });
});
