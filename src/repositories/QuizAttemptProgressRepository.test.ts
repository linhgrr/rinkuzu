import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { type ClientSession } from 'mongoose';
import { WEEKLY_ACTIVITY_RETENTION_DAYS } from '@/lib/learning-progress-retention.mjs';
import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';

const modelMocks = vi.hoisted(() => ({
  attemptCreate: vi.fn(),
  attemptFindOne: vi.fn(),
  attemptFindOneAndUpdate: vi.fn(),
  loggerWarn: vi.fn(),
  attemptLean: vi.fn(),
  attemptSelect: vi.fn(),
  attemptSession: vi.fn(),
  questionBulkWrite: vi.fn(),
  quizProgressDeleteOne: vi.fn(),
  quizProgressSession: vi.fn(),
  userFindOne: vi.fn(),
  userSession: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/Attempt', () => ({
  default: {
    create: modelMocks.attemptCreate,
    findOne: modelMocks.attemptFindOne,
    findOneAndUpdate: modelMocks.attemptFindOneAndUpdate,
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: modelMocks.loggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { bulkWrite: modelMocks.questionBulkWrite },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { deleteOne: modelMocks.quizProgressDeleteOne },
}));
vi.mock('@/models/UserProgress', () => ({
  default: Object.assign(vi.fn(), { findOne: modelMocks.userFindOne }),
}));

import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

const session = Object.assign(Object.create(null), {
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}) as ClientSession;

const submission = {
  userId: '507f191e810c19729de860eb',
  idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
  quizId: '507f191e810c19729de860ea',
  quizSlug: 'architecture',
  quizSnapshot: {
    integrity: 'complete' as const,
    title: 'Architecture',
    slug: 'architecture',
    questions: [
      {
        id: 'question-1',
        question: 'Layer?',
        options: ['Domain', 'UI'],
        type: 'single' as const,
        correctIndex: 0,
      },
    ],
  },
  answers: [0],
  score: 100,
  totalQuestions: 1,
  correctAnswers: 1,
  wrongQuestions: [],
  takenAt: new Date('2026-07-16T00:30:00.000Z'),
};

describe('QuizAttemptProgressRepository', () => {
  const userProgress = {
    isNew: false,
    totalXp: 100,
    totalQuizzesTaken: 2,
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: new Date('2026-07-16T00:10:00.000Z'),
    streakFreezeCount: 0,
    weeklyActivity: new Map(
      Array.from({ length: WEEKLY_ACTIVITY_RETENTION_DAYS + 3 }, (_, index) => {
        const date = new Date('2026-07-16T00:30:00.000Z');
        date.setUTCDate(date.getUTCDate() - index);
        return [
          date.toISOString().slice(0, 10),
          { questionsReviewed: 1, xpEarned: 10, correctCount: 1, totalCount: 1 },
        ] as const;
      }),
    ),
    averageAccuracy: 100,
    save: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
        totalQuestions: 1,
      },
    ]);

    modelMocks.userSession.mockResolvedValue(userProgress);
    modelMocks.userFindOne.mockReturnValue({ session: modelMocks.userSession });
    modelMocks.quizProgressSession.mockResolvedValue({ deletedCount: 1 });
    modelMocks.quizProgressDeleteOne.mockReturnValue({ session: modelMocks.quizProgressSession });
  });

  it('commits attempt, gamification, and saved-progress cleanup in one session', async () => {
    const result = await new QuizAttemptProgressRepository().recordSubmittedAttempt(submission);

    expect(result).toEqual({
      id: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(modelMocks.attemptFindOne).toHaveBeenCalledWith({
      idempotencyKey: submission.idempotencyKey,
      $and: [{ user: submission.userId }, { user: { $type: 'objectId' } }],
    });
    expect(modelMocks.attemptCreate.mock.calls[0]?.[1]).toEqual({ session });
    expect(modelMocks.userSession).toHaveBeenCalledWith(session);
    expect(userProgress.save).toHaveBeenCalledWith({ session });
    expect(modelMocks.quizProgressSession).toHaveBeenCalledWith(session);
    expect([...userProgress.weeklyActivity.keys()]).toHaveLength(WEEKLY_ACTIVITY_RETENTION_DAYS);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('returns the original result for an idempotent retry without repeating side effects', async () => {
    const firstResult = await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      submission,
    );
    const digest = modelMocks.attemptCreate.mock.calls[0]?.[0]?.[0]?.submissionDigest as string;
    modelMocks.attemptLean.mockResolvedValue({
      _id: 'attempt-1',
      submissionDigest: digest,
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    vi.clearAllMocks();
    vi.mocked(session.withTransaction).mockImplementation(async (callback) => callback(session));
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    modelMocks.attemptSession.mockReturnValue({ lean: modelMocks.attemptLean });
    modelMocks.attemptSelect.mockReturnValue({ session: modelMocks.attemptSession });
    modelMocks.attemptFindOne.mockReturnValue({ select: modelMocks.attemptSelect });

    const retryResult = await new QuizAttemptProgressRepository().recordSubmittedAttempt(
      submission,
    );

    expect(retryResult).toEqual(firstResult);
    expect(modelMocks.attemptCreate).not.toHaveBeenCalled();
    expect(userProgress.save).not.toHaveBeenCalled();
    expect(modelMocks.quizProgressDeleteOne).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    modelMocks.attemptLean.mockResolvedValue({
      _id: 'attempt-1',
      submissionDigest: 'f'.repeat(64),
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(submission),
    ).rejects.toBeInstanceOf(QuizAttemptIdempotencyConflictError);
    expect(modelMocks.attemptCreate).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('stores a quick round and binds its idempotency key to the played indices (RIN-936)', async () => {
    const quick = { ...submission, mode: 'quick' as const, questionIndices: [16] };

    await new QuizAttemptProgressRepository().recordSubmittedAttempt(quick);

    const created = modelMocks.attemptCreate.mock.calls[0]?.[0]?.[0];
    expect(created).toMatchObject({ mode: 'quick', questionIndices: [16] });
    expect(created).not.toHaveProperty('retryOfAttemptId');
    const stored = {
      _id: 'attempt-1',
      submissionDigest: created?.submissionDigest as string,
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    };
    modelMocks.attemptLean.mockResolvedValue(stored);
    modelMocks.attemptCreate.mockClear();

    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(quick),
    ).resolves.toMatchObject({ id: 'attempt-1' });
    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt({
        ...quick,
        questionIndices: [3],
      }),
    ).rejects.toBeInstanceOf(QuizAttemptIdempotencyConflictError);
    await expect(
      new QuizAttemptProgressRepository().recordSubmittedAttempt(submission),
    ).rejects.toBeInstanceOf(QuizAttemptIdempotencyConflictError);
    expect(modelMocks.attemptCreate).not.toHaveBeenCalled();
  });

  describe('claimGuestAttempts (RIN-1028)', () => {
    const userId = '507f191e810c19729de860ec';
    const now = new Date('2026-11-06T01:00:00.000Z');
    const claimableSince = new Date('2026-11-05T01:00:00.000Z');
    const claimedRecord = {
      _id: 'attempt-guest',
      correctAnswers: 1,
      totalQuestions: 2,
      quizSnapshot: {
        slug: 'architecture',
        questions: [
          {
            _id: 'q-right',
            question: 'Layer?',
            options: ['Domain', 'UI'],
            type: 'single',
            correctIndex: 0,
          },
          {
            _id: 'q-wrong',
            question: 'Port?',
            options: ['In', 'Out'],
            type: 'single',
            correctIndex: 1,
          },
        ],
      },
      answers: [
        { kind: 'single', selectedIndex: 0 },
        { kind: 'single', selectedIndex: 0 },
      ],
    };

    beforeEach(() => {
      modelMocks.attemptFindOneAndUpdate.mockReturnValue({
        lean: vi.fn().mockResolvedValue(claimedRecord),
      });
    });

    it('writes review-queue progress for the wrong answers only, after the claim commits', async () => {
      modelMocks.questionBulkWrite.mockResolvedValue({});

      const claimed = await new QuizAttemptProgressRepository().claimGuestAttempts(
        userId,
        ['hash-1'],
        now,
        claimableSince,
      );

      expect(claimed).toEqual(['attempt-guest']);
      expect(userProgress.save).toHaveBeenCalledWith({ session });
      expect(modelMocks.questionBulkWrite).toHaveBeenCalledOnce();
      const [writes, options] = modelMocks.questionBulkWrite.mock.calls[0] ?? [];
      // Outside the transaction: no session.
      expect(options).toEqual({ ordered: false });
      expect(writes).toEqual([
        {
          updateOne: {
            filter: { userId, quizSlug: 'architecture', questionId: 'q-wrong' },
            update: {
              $setOnInsert: expect.objectContaining({
                userId,
                quizSlug: 'architecture',
                questionId: 'q-wrong',
                questionRef: { text: 'Port?', options: ['In', 'Out'], correctIndexes: [1] },
                srsLevel: 0,
                nextReviewDate: now,
              }),
            },
            upsert: true,
          },
        },
      ]);
    });

    it('keeps the claim when the progress write fails and logs no learner data', async () => {
      modelMocks.questionBulkWrite.mockRejectedValue(
        Object.assign(new Error('write failed for q-wrong'), { name: 'MongoBulkWriteError' }),
      );

      const claimed = await new QuizAttemptProgressRepository().claimGuestAttempts(
        userId,
        ['hash-1'],
        now,
        claimableSince,
      );

      expect(claimed).toEqual(['attempt-guest']);
      expect(userProgress.save).toHaveBeenCalledWith({ session });
      expect(modelMocks.loggerWarn).toHaveBeenCalledOnce();
      expect(modelMocks.loggerWarn).toHaveBeenCalledWith(
        { attemptId: 'attempt-guest', errorClass: 'MongoBulkWriteError' },
        expect.any(String),
      );
      expect(session.endSession).toHaveBeenCalledOnce();
    });

    it('writes nothing when no attempt matches the hash', async () => {
      modelMocks.attemptFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await expect(
        new QuizAttemptProgressRepository().claimGuestAttempts(
          userId,
          ['hash-1'],
          now,
          claimableSince,
        ),
      ).resolves.toEqual([]);
      expect(modelMocks.questionBulkWrite).not.toHaveBeenCalled();
    });
  });
});
