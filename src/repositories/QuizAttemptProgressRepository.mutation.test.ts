import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { type ClientSession } from 'mongoose';
import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';

const modelMocks = vi.hoisted(() => ({
  attemptCreate: vi.fn(),
  attemptFindOne: vi.fn(),
  attemptLean: vi.fn(),
  attemptSelect: vi.fn(),
  attemptSession: vi.fn(),
  questionBulkWrite: vi.fn(),
  quizProgressDeleteOne: vi.fn(),
  quizProgressSession: vi.fn(),
  userFindOne: vi.fn(),
  userSession: vi.fn(),
  UserProgressCtor: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/Attempt', () => ({
  default: {
    create: modelMocks.attemptCreate,
    findOne: modelMocks.attemptFindOne,
  },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { bulkWrite: modelMocks.questionBulkWrite },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { deleteOne: modelMocks.quizProgressDeleteOne },
}));
vi.mock('@/models/UserProgress', () => ({
  default: Object.assign(modelMocks.UserProgressCtor, { findOne: modelMocks.userFindOne }),
}));

import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import type { RecordQuizAttemptProgressData } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { WrongQuizAttemptQuestion } from '@/entities/QuizAttempt';

const session = Object.assign(Object.create(null), {
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}) as ClientSession;

type AuthenticatedSubmission = Extract<RecordQuizAttemptProgressData, { userId: string }>;
type GuestSubmission = Extract<RecordQuizAttemptProgressData, { guestEmail: string }>;

function baseSubmission(overrides: Partial<AuthenticatedSubmission> = {}): AuthenticatedSubmission {
  return {
    userId: '507f191e810c19729de860eb',
    idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    quizId: '507f191e810c19729de860ea',
    quizSlug: 'architecture',
    quizSnapshot: {
      integrity: 'complete',
      title: 'Architecture',
      slug: 'architecture',
      questions: [
        {
          id: 'question-1',
          question: 'Layer?',
          options: ['Domain', 'UI'],
          type: 'single',
          correctIndex: 0,
        },
      ],
    },
    answers: [0],
    score: 100,
    totalQuestions: 2,
    correctAnswers: 1,
    wrongQuestions: [],
    takenAt: new Date('2026-07-16T00:30:00.000Z'),
    ...overrides,
  };
}

function guestSubmission(overrides: Partial<GuestSubmission> = {}): GuestSubmission {
  return {
    guestEmail: 'guest@example.com',
    idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    quizId: '507f191e810c19729de860ea',
    quizSlug: 'architecture',
    quizSnapshot: {
      integrity: 'complete',
      title: 'Architecture',
      slug: 'architecture',
      questions: [
        {
          id: 'question-1',
          question: 'Layer?',
          options: ['Domain', 'UI'],
          type: 'single',
          correctIndex: 0,
        },
      ],
    },
    answers: [0],
    score: 100,
    totalQuestions: 2,
    correctAnswers: 1,
    wrongQuestions: [],
    takenAt: new Date('2026-07-16T00:30:00.000Z'),
    ...overrides,
  };
}

function createUserProgress(overrides: Record<string, unknown> = {}) {
  return {
    isNew: false,
    totalXp: 100,
    totalQuizzesTaken: 2,
    currentStreak: 3,
    longestStreak: 5,
    lastActiveDate: new Date('2026-07-16T00:10:00.000Z'),
    streakFreezeCount: 0,
    weeklyActivity: new Map<
      string,
      { questionsReviewed: number; xpEarned: number; correctCount: number; totalCount: number }
    >(),
    averageAccuracy: 50,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('QuizAttemptProgressRepository mutation coverage', () => {
  let userProgress = createUserProgress();

  beforeEach(() => {
    vi.clearAllMocks();
    userProgress = createUserProgress();
    vi.mocked(session.withTransaction).mockImplementation(async (callback) => callback(session));
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    modelMocks.attemptLean.mockResolvedValue(null);
    modelMocks.attemptSession.mockReturnValue({ lean: modelMocks.attemptLean });
    modelMocks.attemptSelect.mockReturnValue({ session: modelMocks.attemptSession });
    modelMocks.attemptFindOne.mockReturnValue({ select: modelMocks.attemptSelect });
    modelMocks.attemptCreate.mockResolvedValue([
      {
        _id: 'attempt-1',
        score: 100,
        correctAnswers: 1,
        totalQuestions: 2,
      },
    ]);

    modelMocks.userSession.mockResolvedValue(userProgress);
    modelMocks.userFindOne.mockReturnValue({ session: modelMocks.userSession });
    modelMocks.quizProgressSession.mockResolvedValue({ deletedCount: 1 });
    modelMocks.quizProgressDeleteOne.mockReturnValue({ session: modelMocks.quizProgressSession });
    modelMocks.UserProgressCtor.mockImplementation(function UserProgressMock(
      this: unknown,
      doc: { userId: string },
    ) {
      userProgress = createUserProgress({
        isNew: true,
        totalXp: 0,
        totalQuizzesTaken: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: new Date(0),
        streakFreezeCount: 0,
        weeklyActivity: new Map(),
        averageAccuracy: 0,
        userId: doc.userId,
      });
      return userProgress;
    });
  });

  it('records guest attempts with guestEmail identity and skips user progress writes', async () => {
    const guest = guestSubmission();

    const result = await new QuizAttemptProgressRepository().recordSubmittedAttempt(guest);

    expect(result).toEqual({
      id: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 2,
    });
    expect(modelMocks.attemptFindOne).toHaveBeenCalledWith({
      idempotencyKey: guest.idempotencyKey,
      $and: [{ guestEmail: 'guest@example.com' }, { guestEmail: { $type: 'string' } }],
    });
    const created = modelMocks.attemptCreate.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(created).toMatchObject({
      guestEmail: 'guest@example.com',
      quiz: guest.quizId,
      score: 100,
      correctAnswers: 1,
      totalQuestions: 2,
    });
    expect(created).not.toHaveProperty('user');
    expect(modelMocks.userFindOne).not.toHaveBeenCalled();
    expect(modelMocks.questionBulkWrite).not.toHaveBeenCalled();
    expect(modelMocks.quizProgressDeleteOne).not.toHaveBeenCalled();
  });

  it('builds question progress upserts for single and multi wrong questions and dedupes ids', async () => {
    const wrongQuestions: WrongQuizAttemptQuestion[] = [
      {
        questionId: 'q-single',
        question: {
          id: 'q-single',
          question: 'Single?',
          options: ['A', 'B'],
          type: 'single',
          correctIndex: 1,
        },
      },
      {
        questionId: 'q-single',
        question: {
          id: 'q-single',
          question: 'Single duplicate?',
          options: ['A', 'B'],
          type: 'single',
          correctIndex: 1,
        },
      },
      {
        questionId: 'q-multi',
        question: {
          id: 'q-multi',
          question: 'Multi?',
          options: ['A', 'B', 'C'],
          type: 'multiple',
          correctIndexes: [0, 2],
        },
      },
    ];
    const submission = baseSubmission({ wrongQuestions });

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(submission);

    expect(modelMocks.questionBulkWrite).toHaveBeenCalledOnce();
    const writes = modelMocks.questionBulkWrite.mock.calls[0]?.[0] as Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: { $setOnInsert: Record<string, unknown> };
        upsert: boolean;
      };
    }>;
    expect(writes).toHaveLength(2);
    expect(writes[0]?.updateOne.filter).toEqual({
      userId: submission.userId,
      quizSlug: 'architecture',
      questionId: 'q-single',
    });
    expect(writes[0]?.updateOne.update.$setOnInsert).toMatchObject({
      questionRef: {
        text: 'Single duplicate?',
        options: ['A', 'B'],
        correctIndexes: [1],
      },
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      correctStreak: 0,
      totalReviews: 0,
      totalCorrect: 0,
      history: [],
      lastReviewDate: null,
    });
    expect(writes[0]?.updateOne.upsert).toBe(true);
    expect(writes[1]?.updateOne.update.$setOnInsert).toMatchObject({
      questionRef: {
        text: 'Multi?',
        options: ['A', 'B', 'C'],
        correctIndexes: [0, 2],
      },
    });
    expect(modelMocks.questionBulkWrite.mock.calls[0]?.[1]).toEqual({
      ordered: false,
      session,
    });
  });

  it('rejects incomplete correct indexes on wrong questions', async () => {
    const badSingle = baseSubmission({
      wrongQuestions: [
        {
          questionId: 'q1',
          question: {
            id: 'q1',
            question: 'bad single',
            options: ['A'],
            type: 'single',
            correctIndex: Number.NaN,
          },
        },
      ],
    });
    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(badSingle),
    ).rejects.toThrow(TypeError);

    const badMulti = baseSubmission({
      wrongQuestions: [
        {
          questionId: 'q2',
          question: {
            id: 'q2',
            question: 'bad multi',
            options: ['A'],
            type: 'multiple',
            correctIndexes: [],
          },
        },
      ],
    });
    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(badMulti),
    ).rejects.toThrow('Multiple-choice question.correctIndexes is required');
  });

  it('applies XP, quiz count, same-day streak freeze, and weekly accuracy', async () => {
    userProgress = createUserProgress({
      lastActiveDate: new Date('2026-07-16T00:05:00.000Z'),
      currentStreak: 4,
      longestStreak: 4,
      totalXp: 50,
      totalQuizzesTaken: 1,
      weeklyActivity: new Map([
        ['2026-07-16', { questionsReviewed: 1, xpEarned: 10, correctCount: 1, totalCount: 1 }],
      ]),
    });
    modelMocks.userSession.mockResolvedValue(userProgress);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      baseSubmission({
        correctAnswers: 3,
        totalQuestions: 5,
        takenAt: new Date('2026-07-16T12:00:00.000Z'),
      }),
    );

    expect(userProgress.totalXp).toBe(50 + 30);
    expect(userProgress.totalQuizzesTaken).toBe(2);
    expect(userProgress.currentStreak).toBe(4);
    expect(userProgress.weeklyActivity.get('2026-07-16')).toEqual({
      questionsReviewed: 6,
      xpEarned: 40,
      correctCount: 4,
      totalCount: 6,
    });
    expect(userProgress.averageAccuracy).toBe(Math.round((4 / 6) * 100));
    expect(userProgress.save).toHaveBeenCalledWith({ session });
    expect(modelMocks.quizProgressDeleteOne).toHaveBeenCalledWith({
      userId: '507f191e810c19729de860eb',
      quiz: '507f191e810c19729de860ea',
    });
  });

  it('continues streak when last active day was yesterday', async () => {
    userProgress = createUserProgress({
      lastActiveDate: new Date('2026-07-15T20:00:00.000Z'),
      currentStreak: 2,
      longestStreak: 2,
    });
    modelMocks.userSession.mockResolvedValue(userProgress);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      baseSubmission({ takenAt: new Date('2026-07-16T08:00:00.000Z') }),
    );

    expect(userProgress.currentStreak).toBe(3);
    expect(userProgress.longestStreak).toBe(3);
    expect(userProgress.lastActiveDate).toEqual(new Date('2026-07-16T08:00:00.000Z'));
  });

  it('consumes streak freeze when last active day was two days ago', async () => {
    userProgress = createUserProgress({
      lastActiveDate: new Date('2026-07-14T12:00:00.000Z'),
      currentStreak: 5,
      longestStreak: 5,
      streakFreezeCount: 2,
    });
    modelMocks.userSession.mockResolvedValue(userProgress);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      baseSubmission({ takenAt: new Date('2026-07-16T08:00:00.000Z') }),
    );

    expect(userProgress.streakFreezeCount).toBe(1);
    expect(userProgress.currentStreak).toBe(6);
    expect(userProgress.longestStreak).toBe(6);
  });

  it('resets streak when gap exceeds freeze window or freeze is unavailable', async () => {
    userProgress = createUserProgress({
      lastActiveDate: new Date('2026-07-14T12:00:00.000Z'),
      currentStreak: 5,
      longestStreak: 9,
      streakFreezeCount: 0,
    });
    modelMocks.userSession.mockResolvedValue(userProgress);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      baseSubmission({ takenAt: new Date('2026-07-16T08:00:00.000Z') }),
    );

    expect(userProgress.currentStreak).toBe(1);
    expect(userProgress.longestStreak).toBe(9);
  });

  it('starts streak at 1 for brand-new user progress documents', async () => {
    modelMocks.userSession.mockResolvedValue(null);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      baseSubmission({
        correctAnswers: 0,
        totalQuestions: 2,
        takenAt: new Date('2026-07-16T08:00:00.000Z'),
      }),
    );

    expect(modelMocks.UserProgressCtor).toHaveBeenCalledWith({
      userId: '507f191e810c19729de860eb',
    });
    expect(userProgress.isNew).toBe(true);
    expect(userProgress.currentStreak).toBe(1);
    expect(userProgress.totalXp).toBe(0);
    expect(userProgress.totalQuizzesTaken).toBe(1);
    expect(userProgress.averageAccuracy).toBe(0);
  });

  it('maps quiz snapshot question ids to _id and persists answers', async () => {
    await new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission());

    const created = modelMocks.attemptCreate.mock.calls[0]?.[0]?.[0] as {
      quizSnapshot: { questions: Array<Record<string, unknown>> };
      answers: unknown[];
      submissionDigest: string;
    };
    expect(created.quizSnapshot.questions[0]).toMatchObject({
      _id: 'question-1',
      question: 'Layer?',
      options: ['Domain', 'UI'],
      type: 'single',
      correctIndex: 0,
    });
    expect(created.quizSnapshot.questions[0]).not.toHaveProperty('id');
    expect(created.answers).toEqual([{ kind: 'single', selectedIndex: 0 }]);
    expect(created.submissionDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(modelMocks.attemptCreate.mock.calls[0]?.[1]).toEqual({ session });
  });

  it('throws when attempt create returns no document', async () => {
    modelMocks.attemptCreate.mockResolvedValueOnce([]);

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission()),
    ).rejects.toThrow('Attempt transaction did not create a document');
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('throws when transaction completes without a result', async () => {
    vi.mocked(session.withTransaction).mockImplementation(async () => undefined);

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission()),
    ).rejects.toThrow('Quiz attempt transaction did not commit');
  });

  it('retries once on duplicate key and returns matching existing attempt', async () => {
    const digestSource = baseSubmission();
    modelMocks.attemptCreate.mockRejectedValueOnce({ code: 11000 });
    const { createHash } = await import('node:crypto');
    const submissionDigest = createHash('sha256')
      .update(JSON.stringify({ quizId: digestSource.quizId, answers: digestSource.answers }))
      .digest('hex');

    modelMocks.attemptLean.mockResolvedValueOnce(null).mockResolvedValueOnce({
      _id: 'attempt-dup',
      submissionDigest,
      score: 100,
      correctAnswers: 1,
      totalQuestions: 2,
    });

    const result = await new QuizAttemptProgressRepository().recordSubmittedAttempt(digestSource);

    expect(result).toEqual({
      id: 'attempt-dup',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 2,
    });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('rethrows non-duplicate errors and conflicts on mismatched digest after duplicate', async () => {
    modelMocks.attemptCreate.mockRejectedValueOnce(new Error('write concern'));
    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission()),
    ).rejects.toThrow('write concern');

    modelMocks.attemptCreate.mockRejectedValueOnce({ code: 11000 });
    modelMocks.attemptLean.mockResolvedValueOnce(null).mockResolvedValueOnce({
      _id: 'attempt-x',
      submissionDigest: '0'.repeat(64),
      score: 10,
      correctAnswers: 0,
      totalQuestions: 1,
    });

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission()),
    ).rejects.toBeInstanceOf(QuizAttemptIdempotencyConflictError);
  });

  it('rethrows duplicate key after exhausting transaction attempts when no existing attempt is found', async () => {
    modelMocks.attemptCreate.mockRejectedValue({ code: 11000 });
    modelMocks.attemptLean.mockResolvedValue(null);

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission()),
    ).rejects.toMatchObject({ code: 11000 });
    expect(session.withTransaction).toHaveBeenCalledTimes(2);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('skips question bulkWrite when there are no wrong questions', async () => {
    await new QuizAttemptProgressRepository().recordSubmittedAttempt(baseSubmission());
    expect(modelMocks.questionBulkWrite).not.toHaveBeenCalled();
  });
});
