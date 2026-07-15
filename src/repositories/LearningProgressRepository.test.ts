import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  attemptAggregate: vi.fn(),
  quizAggregate: vi.fn(),
  quizProgressAggregate: vi.fn(),
  questionFindOne: vi.fn(),
  questionFindOneAndUpdate: vi.fn(),
  userFindOne: vi.fn(),
  userFindOneAndUpdate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: { aggregate: modelMocks.attemptAggregate },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: {
    findOne: modelMocks.questionFindOne,
    findOneAndUpdate: modelMocks.questionFindOneAndUpdate,
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
  },
}));

import mongoose, { type ClientSession } from 'mongoose';
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
});
