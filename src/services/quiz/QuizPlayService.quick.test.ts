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
const quickAttemptId = '507f191e810c19729de860ec';
const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';

/** Question `q<i>` has its correct option at `i % 3`. */
function makeQuestions(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `q${index}`,
    question: `Question ${index}?`,
    options: ['a', 'b', 'c'],
    type: 'single' as const,
    correctIndex: index % 3,
  }));
}

function makeQuiz(count: number): Quiz {
  return {
    id: quizId,
    title: 'Fake long quiz',
    slug: 'fake-long-quiz',
    author: '507f191e810c19729de860ff',
    visibility: 'public',
    questions: makeQuestions(count),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  };
}

/** Ten quiz question indices in play order (not ascending). */
const playOrder = [15, 2, 9, 0, 11, 5, 14, 7, 3, 12];
const correctFor = (quizIndex: number) => quizIndex % 3;
const wrongFor = (quizIndex: number) => (quizIndex + 1) % 3;
/** First 7 played right, last 3 wrong: 7/10. */
const answers = playOrder.map((quizIndex, position) =>
  position < 7 ? correctFor(quizIndex) : wrongFor(quizIndex),
);

const learnerSession: Session = {
  user: { id: learnerId, email: 'learner@example.test', role: 'user' },
  expires: '2026-12-01T00:00:00.000Z',
};

function createService(quiz: Quiz, source: Attempt | null = null) {
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
        id: quickAttemptId,
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
  return { service, attemptProgressRepository };
}

function submitQuick(
  service: QuizPlayService,
  indices: number[],
  options: { answers?: number[]; session?: Session | null; retryOf?: string } = {},
) {
  return service.submitQuizAttempt(
    'fake-long-quiz',
    options.answers ?? answers,
    idempotencyKey,
    options.session === undefined ? learnerSession : options.session,
    options.session === null ? 'guest@example.test' : undefined,
    options.retryOf,
    undefined,
    indices,
  );
}

describe('QuizPlayService quick round submit (RIN-936)', () => {
  it('scores X/10 over the chosen questions in play order and stores a normal quick attempt', async () => {
    const quiz = makeQuiz(16);
    const { service, attemptProgressRepository } = createService(quiz);

    const result = await submitQuick(service, playOrder);

    assertOk(result);
    expect(result.data).toMatchObject({ score: 70, correctAnswers: 7, totalQuestions: 10 });
    const stored = attemptProgressRepository.recordSubmittedAttempt.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      userId: learnerId,
      quizId,
      mode: 'quick',
      questionIndices: playOrder,
      totalQuestions: 10,
      correctAnswers: 7,
    });
    expect(stored?.quizSnapshot.questions.map((question) => question.id)).toEqual(
      playOrder.map((index) => `q${index}`),
    );
    expect(stored?.wrongQuestions.map((wrong) => wrong.questionId)).toEqual(['q7', 'q3', 'q12']);
    expect(stored).not.toHaveProperty('retryOfAttemptId');
  });

  it('accepts a guest quick round like any guest attempt', async () => {
    const { service, attemptProgressRepository } = createService(makeQuiz(20));

    const result = await submitQuick(service, playOrder, { session: null });

    assertOk(result);
    expect(attemptProgressRepository.recordSubmittedAttempt.mock.calls[0]?.[0]).toMatchObject({
      guestEmail: 'guest@example.test',
      mode: 'quick',
    });
  });

  it('rejects a quiz of 15 questions (the threshold is more than 15)', async () => {
    const { service, attemptProgressRepository } = createService(makeQuiz(15));

    const result = await submitQuick(service, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 400, code: 'validation_error' });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('rejects an index outside the quiz', async () => {
    const { service, attemptProgressRepository } = createService(makeQuiz(16));

    const result = await submitQuick(service, [16, 2, 9, 0, 11, 5, 14, 7, 3, 12]);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 400, code: 'validation_error' });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('rejects answers that do not match the 10 chosen questions', async () => {
    const { service } = createService(makeQuiz(16));

    const result = await submitQuick(service, playOrder, { answers: answers.slice(0, 9) });

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('rejects a quick round combined with a retry', async () => {
    const { service, attemptProgressRepository } = createService(makeQuiz(16));

    const result = await submitQuick(service, playOrder, { retryOf: quickAttemptId });

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 400, code: 'validation_error' });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });
});

describe('QuizPlayService retry of a quick round (RIN-936 AC6)', () => {
  it('replays only the wrong or unanswered questions of that round', async () => {
    const quiz = makeQuiz(16);
    const quickAnswers = [...answers];
    quickAnswers[1] = -1; // q2 left unanswered
    const source: Attempt = {
      id: quickAttemptId,
      user: learnerId,
      quiz: {
        id: quizId,
        title: quiz.title,
        slug: quiz.slug,
        questions: playOrder.map((index) => quiz.questions[index] as QuizQuestion),
      },
      answers: quickAnswers,
      score: 60,
      totalQuestions: 10,
      takenAt: new Date('2026-11-01T00:00:00Z'),
      mode: 'quick',
      questionIndices: playOrder,
    };
    const { service } = createService(quiz, source);

    const result = await service.getRetryQuizForPlay('fake-long-quiz', quickAttemptId, learnerId);

    assertOk(result);
    // Missed in the round: q2 (blank), q7, q3, q12 (wrong). The 6 unplayed questions are absent.
    expect(result.data.retry?.questionIndices).toEqual([2, 3, 7, 12]);
    expect(result.data.questions.map((question) => question.id)).toEqual(['q2', 'q3', 'q7', 'q12']);
  });
});
