import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  attemptAggregate: vi.fn(),
  quizAggregate: vi.fn(),
  quizProgressAggregate: vi.fn(),
  questionFind: vi.fn(),
  questionFindOne: vi.fn(),
  questionFindOneAndUpdate: vi.fn(),
  questionCountDocuments: vi.fn(),
  questionSort: vi.fn(),
  questionLimit: vi.fn(),
  questionLean: vi.fn(),
  userFindOne: vi.fn(),
  userFindOneAndUpdate: vi.fn(),
  userUpdateOne: vi.fn(),
  userSelect: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: { aggregate: modelMocks.attemptAggregate },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: {
    find: modelMocks.questionFind,
    findOne: modelMocks.questionFindOne,
    findOneAndUpdate: modelMocks.questionFindOneAndUpdate,
    countDocuments: modelMocks.questionCountDocuments,
  },
}));
vi.mock('@/models/Quiz', () => ({
  default: { aggregate: modelMocks.quizAggregate },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { aggregate: modelMocks.quizProgressAggregate },
}));
vi.mock('@/models/UserProgress', () => ({
  default: {
    findOne: modelMocks.userFindOne,
    findOneAndUpdate: modelMocks.userFindOneAndUpdate,
    updateOne: modelMocks.userUpdateOne,
  },
}));

import mongoose, { type ClientSession } from 'mongoose';
import {
  QUESTION_REVIEW_HISTORY_LIMIT,
  WEEKLY_ACTIVITY_RETENTION_DAYS,
} from '@/lib/learning-progress-retention.mjs';
import { LearningProgressRepository } from '@/repositories/LearningProgressRepository';

describe('LearningProgressRepository.listLibraryQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.quizAggregate.mockResolvedValue([{ items: [], meta: [{ totalItems: 0 }] }]);
  });

  it('builds the user library in one aggregation without duplicate activity scans', async () => {
    const repository = new LearningProgressRepository();

    await expect(
      repository.listLibraryQuizzes('507f191e810c19729de860ea', {
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      items: [],
      pagination: {
        currentPage: 1,
        totalItems: 0,
        itemsPerPage: 20,
      },
    });

    expect(modelMocks.attemptAggregate).not.toHaveBeenCalled();
    expect(modelMocks.quizProgressAggregate).not.toHaveBeenCalled();
    expect(modelMocks.quizAggregate).toHaveBeenCalledOnce();

    const pipeline = modelMocks.quizAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(
      pipeline
        .filter((stage) => '$unionWith' in stage)
        .map((stage) => (stage['$unionWith'] as { coll: string }).coll),
    ).toEqual(['attempts', 'quizprogresses']);
    expect(pipeline).toContainEqual({
      $facet: expect.objectContaining({
        items: expect.arrayContaining([{ $skip: 0 }, { $limit: 20 }]),
        meta: [{ $count: 'totalItems' }],
      }),
    });

    const replaceRootIndex = pipeline.findIndex((stage) => '$replaceRoot' in stage);
    const folderLookupIndex = pipeline.findIndex(
      (stage) => (stage['$lookup'] as { from?: string } | undefined)?.from === 'folderquizzes',
    );

    expect(pipeline.slice(replaceRootIndex + 1, folderLookupIndex)).toEqual([
      { $addFields: { questionCount: { $size: { $ifNull: ['$questions', []] } } } },
      { $project: { questions: 0 } },
    ]);
  });
});

describe('LearningProgressRepository.mutateReviewProgress', () => {
  const withTransaction = vi.fn();
  const endSession = vi.fn();
  const session: ClientSession = Object.assign(Object.create(null), {
    withTransaction,
    endSession,
  });
  const questionSession = vi.fn();
  const userSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    const now = new Date('2026-07-15T12:00:00.000Z');
    const questionRecord = {
      _id: '507f1f77bcf86cd799439012',
      userId: 'user-1',
      quizSlug: 'architecture',
      questionId: 'question-1',
      questionRef: undefined,
      srsLevel: 0,
      nextReviewDate: now,
      lastReviewDate: null,
      interval: 0,
      easeFactor: 2.5,
      correctStreak: 0,
      totalReviews: 0,
      totalCorrect: 0,
      history: [],
      isBookmarked: false,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    const userRecord = {
      userId: 'user-1',
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: now,
      streakFreezeCount: 0,
      totalXp: 10,
      totalQuestionsLearned: 0,
      totalQuizzesTaken: 0,
      totalReviewSessions: 1,
      lastSessionDate: now,
      averageAccuracy: 100,
      weeklyActivity: {},
    };

    questionSession.mockReturnValue({ lean: vi.fn().mockResolvedValue(questionRecord) });
    userSession.mockReturnValue({ lean: vi.fn().mockResolvedValue(userRecord) });
    modelMocks.questionFindOne.mockReturnValue({ session: questionSession });
    modelMocks.userFindOne.mockReturnValue({ session: userSession });
    modelMocks.questionFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...questionRecord, totalReviews: 1 }),
    });
    modelMocks.userFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...userRecord, totalXp: 20 }),
    });
  });

  it('reads and writes both progress documents in one transaction session', async () => {
    const repository = new LearningProgressRepository();

    const result = await repository.mutateReviewProgress(
      'user-1',
      'architecture',
      'question-1',
      (questionProgress, userProgress) => {
        if (!questionProgress || !userProgress) throw new Error('Expected existing progress');
        return {
          questionProgress: { ...questionProgress, totalReviews: 1 },
          userProgress: { ...userProgress, totalXp: 20 },
          streakFreezeUsed: false,
        };
      },
    );

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(questionSession).toHaveBeenCalledWith(session);
    expect(userSession).toHaveBeenCalledWith(session);
    expect(modelMocks.questionFindOneAndUpdate.mock.calls[0]?.[2]).toMatchObject({ session });
    expect(modelMocks.userFindOneAndUpdate.mock.calls[0]?.[2]).toMatchObject({ session });
    expect(endSession).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      questionProgress: { totalReviews: 1 },
      userProgress: { totalXp: 20 },
      streakFreezeUsed: false,
    });
  });

  it('bounds embedded progress history before writing the transaction', async () => {
    const repository = new LearningProgressRepository();
    const history = Array.from({ length: QUESTION_REVIEW_HISTORY_LIMIT + 5 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)),
      rating: 'good' as const,
    }));
    const weeklyActivity = new Map(
      Array.from({ length: WEEKLY_ACTIVITY_RETENTION_DAYS + 3 }, (_, index) => {
        const date = new Date('2026-07-15T12:00:00.000Z');
        date.setUTCDate(date.getUTCDate() - index);
        return [
          date.toISOString().slice(0, 10),
          { questionsReviewed: 1, xpEarned: 10, correctCount: 1, totalCount: 1 },
        ] as const;
      }),
    );

    await repository.mutateReviewProgress(
      'user-1',
      'architecture',
      'question-1',
      (questionProgress, userProgress) => {
        if (!questionProgress || !userProgress) throw new Error('Expected existing progress');
        return {
          questionProgress: { ...questionProgress, history },
          userProgress: { ...userProgress, weeklyActivity },
          streakFreezeUsed: false,
        };
      },
    );

    const questionUpdate = modelMocks.questionFindOneAndUpdate.mock.calls[0]?.[1] as {
      $set: { history: typeof history };
    };
    const userUpdate = modelMocks.userFindOneAndUpdate.mock.calls[0]?.[1] as {
      $set: { weeklyActivity: Map<string, unknown> };
    };
    expect(questionUpdate.$set.history).toEqual(history.slice(-QUESTION_REVIEW_HISTORY_LIMIT));
    expect([...userUpdate.$set.weeklyActivity.keys()]).toHaveLength(WEEKLY_ACTIVITY_RETENTION_DAYS);
    expect(userUpdate.$set.weeklyActivity.has('2026-07-01')).toBe(false);
  });
});

describe('LearningProgressRepository progress CRUD helpers', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');
  const questionRecord = {
    _id: '507f1f77bcf86cd799439012',
    userId: 'user-1',
    quizSlug: 'architecture',
    questionId: 'question-1',
    srsLevel: 1,
    nextReviewDate: now,
    lastReviewDate: null,
    interval: 1,
    easeFactor: 2.5,
    correctStreak: 1,
    totalReviews: 1,
    totalCorrect: 1,
    history: [],
    isBookmarked: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  const userRecord = {
    userId: 'user-1',
    currentStreak: 1,
    longestStreak: 2,
    lastActiveDate: now,
    streakFreezeCount: 0,
    totalXp: 100,
    totalQuestionsLearned: 3,
    totalQuizzesTaken: 1,
    totalReviewSessions: 1,
    lastSessionDate: now,
    averageAccuracy: 80,
    weeklyActivity: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.questionLean.mockResolvedValue([questionRecord]);
    modelMocks.questionLimit.mockReturnValue({ lean: modelMocks.questionLean });
    modelMocks.questionSort.mockReturnValue({ limit: modelMocks.questionLimit });
    modelMocks.questionFind.mockReturnValue({ sort: modelMocks.questionSort });
    modelMocks.questionFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(questionRecord),
    });
    modelMocks.questionFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue(questionRecord),
    });
    modelMocks.userFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(userRecord),
      select: modelMocks.userSelect,
    });
    modelMocks.userFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue(userRecord),
    });
    modelMocks.questionCountDocuments.mockResolvedValue(4);
    modelMocks.userUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it('lists due questions ordered by next review date', async () => {
    const repository = new LearningProgressRepository();
    await expect(repository.listDueQuestions('user-1', now, 10)).resolves.toMatchObject([
      { questionId: 'question-1', srsLevel: 1 },
    ]);
    expect(modelMocks.questionFind).toHaveBeenCalledWith({
      userId: 'user-1',
      nextReviewDate: { $lte: now },
    });
    expect(modelMocks.questionSort).toHaveBeenCalledWith({ nextReviewDate: 1 });
    expect(modelMocks.questionLimit).toHaveBeenCalledWith(10);
  });

  it('finds and saves question and user progress documents', async () => {
    const repository = new LearningProgressRepository();

    await expect(
      repository.findQuestionProgress('user-1', 'architecture', 'question-1'),
    ).resolves.toMatchObject({ questionId: 'question-1' });
    await expect(repository.findUserProgress('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      totalXp: 100,
    });

    const defaults = repository.createDefaultUserProgress('user-2');
    expect(defaults).toMatchObject({
      userId: 'user-2',
      currentStreak: 0,
      totalXp: 0,
      lastSessionDate: null,
    });
    expect(defaults.weeklyActivity).toBeInstanceOf(Map);

    await expect(
      repository.saveQuestionProgress({
        userId: 'user-1',
        quizSlug: 'architecture',
        questionId: 'question-1',
        srsLevel: 1,
        nextReviewDate: now,
        lastReviewDate: null,
        interval: 1,
        easeFactor: 2.5,
        correctStreak: 1,
        totalReviews: 1,
        totalCorrect: 1,
        history: [],
        isBookmarked: false,
        notes: '',
      }),
    ).resolves.toMatchObject({ questionId: 'question-1' });

    await expect(
      repository.saveUserProgress({
        userId: 'user-1',
        currentStreak: 1,
        longestStreak: 2,
        lastActiveDate: now,
        streakFreezeCount: 0,
        totalXp: 100,
        totalQuestionsLearned: 3,
        totalQuizzesTaken: 1,
        totalReviewSessions: 1,
        lastSessionDate: now,
        averageAccuracy: 80,
        weeklyActivity: new Map(),
      }),
    ).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('maps streak-freeze purchase guard outcomes and successful purchases', async () => {
    const repository = new LearningProgressRepository();
    const options = { cost: 50, maxFreezes: 2 };

    modelMocks.userSelect.mockReturnValueOnce(null);
    await expect(repository.buyStreakFreeze('user-1', options)).resolves.toEqual({
      status: 'not_found',
    });

    modelMocks.userSelect.mockReturnValueOnce({
      totalXp: 100,
      streakFreezeCount: 2,
      save: vi.fn(),
    });
    await expect(repository.buyStreakFreeze('user-1', options)).resolves.toEqual({
      status: 'max_freezes',
    });

    modelMocks.userSelect.mockReturnValueOnce({
      totalXp: 10,
      streakFreezeCount: 0,
      save: vi.fn(),
    });
    await expect(repository.buyStreakFreeze('user-1', options)).resolves.toEqual({
      status: 'not_enough_xp',
    });

    const progress = {
      totalXp: 100,
      streakFreezeCount: 0,
      save: vi.fn().mockResolvedValue(undefined),
    };
    modelMocks.userSelect.mockReturnValueOnce(progress);
    await expect(repository.buyStreakFreeze('user-1', options)).resolves.toEqual({
      status: 'purchased',
      xp: 50,
      streakFreezeCount: 1,
    });
    expect(progress.save).toHaveBeenCalledOnce();
  });

  it('counts learned questions and updates the denormalized total', async () => {
    const repository = new LearningProgressRepository();

    await expect(repository.countLearnedQuestions('user-1')).resolves.toBe(4);
    expect(modelMocks.questionCountDocuments).toHaveBeenCalledWith({
      userId: 'user-1',
      srsLevel: { $gt: 0 },
    });

    await repository.updateTotalQuestionsLearned('user-1', 9);
    expect(modelMocks.userUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { totalQuestionsLearned: 9 },
    );
  });
});
