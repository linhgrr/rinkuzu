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
    expect(pipeline[0]).toEqual({
      $match: { author: expect.any(mongoose.Types.ObjectId) },
    });
    expect(pipeline[1]).toEqual({
      $project: {
        _id: 1,
        lastAttemptAt: { $literal: null },
        lastProgressAt: { $literal: null },
      },
    });
    expect(pipeline[2]).toEqual({
      $unionWith: {
        coll: 'attempts',
        pipeline: [
          { $match: { user: expect.any(mongoose.Types.ObjectId) } },
          { $group: { _id: '$quiz', lastAttemptAt: { $max: '$takenAt' } } },
          {
            $project: {
              lastAttemptAt: 1,
              lastProgressAt: { $literal: null },
            },
          },
        ],
      },
    });
    expect(pipeline[3]).toEqual({
      $unionWith: {
        coll: 'quizprogresses',
        pipeline: [
          { $match: { userId: expect.any(mongoose.Types.ObjectId) } },
          { $group: { _id: '$quiz', lastProgressAt: { $max: '$updatedAt' } } },
          {
            $project: {
              lastAttemptAt: { $literal: null },
              lastProgressAt: 1,
            },
          },
        ],
      },
    });
    expect(pipeline[4]).toEqual({
      $group: {
        _id: '$_id',
        lastAttemptAt: { $max: '$lastAttemptAt' },
        lastProgressAt: { $max: '$lastProgressAt' },
      },
    });
    expect(pipeline[5]).toEqual({
      $lookup: {
        from: 'quizzes',
        localField: '_id',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              title: 1,
              slug: 1,
              description: 1,
              author: 1,
              folder: 1,
              isPrivate: 1,
              pdfUrl: 1,
              createdAt: 1,
              updatedAt: 1,
              questionCount: { $size: { $ifNull: ['$questions', []] } },
            },
          },
        ],
        as: 'quiz',
      },
    });
    expect(pipeline[6]).toEqual({ $unwind: '$quiz' });
    expect(pipeline[7]).toEqual({
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            '$quiz',
            {
              lastAttemptAt: '$lastAttemptAt',
              lastProgressAt: '$lastProgressAt',
            },
          ],
        },
      },
    });
    expect(pipeline).toContainEqual({
      $lookup: {
        from: 'folderquizzes',
        let: { quizId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$quiz', '$$quizId'] },
                  { $eq: ['$owner', expect.any(mongoose.Types.ObjectId)] },
                ],
              },
            },
          },
          { $project: { _id: 0, folder: 1 } },
          { $limit: 1 },
        ],
        as: 'folderLinks',
      },
    });
    expect(pipeline).toContainEqual({
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              email: 1,
              name: 1,
              displayName: 1,
              avatar: 1,
            },
          },
        ],
        as: 'authorDoc',
      },
    });
    expect(pipeline).toContainEqual({
      $addFields: {
        authorDoc: { $first: '$authorDoc' },
        ownedByMe: { $eq: ['$author', expect.any(mongoose.Types.ObjectId)] },
        externalFolder: { $first: '$folderLinks.folder' },
      },
    });
    expect(pipeline).toContainEqual({
      $addFields: {
        effectiveFolder: {
          $cond: [
            '$ownedByMe',
            { $ifNull: ['$folder', null] },
            { $ifNull: ['$externalFolder', null] },
          ],
        },
        displayDateSort: {
          $ifNull: ['$lastProgressAt', { $ifNull: ['$lastAttemptAt', '$createdAt'] }],
        },
      },
    });
    expect(pipeline).toContainEqual({ $sort: { displayDateSort: -1, _id: -1 } });
    expect(pipeline).toContainEqual({
      $facet: {
        items: [
          { $skip: 0 },
          { $limit: 20 },
          {
            $project: {
              _id: 1,
              title: 1,
              slug: 1,
              description: 1,
              author: {
                _id: { $ifNull: ['$authorDoc._id', '$author'] },
                email: '$authorDoc.email',
                name: '$authorDoc.name',
                displayName: '$authorDoc.displayName',
                avatar: '$authorDoc.avatar',
              },
              folder: '$effectiveFolder',
              isPrivate: 1,
              pdfUrl: 1,
              questionCount: 1,
              createdAt: 1,
              updatedAt: 1,
              lastAttemptAt: 1,
              lastProgressAt: 1,
            },
          },
        ],
        meta: [{ $count: 'totalItems' }],
      },
    });

    // Early projection: questionCount is computed inside the quizzes lookup before unwind/merge.
    // No later stage may load, size, or strip a questions array.
    const quizzesLookupStage = pipeline[5];
    expect(quizzesLookupStage).toBeDefined();
    const quizzesLookup = quizzesLookupStage?.['$lookup'] as {
      from: string;
      pipeline: Array<Record<string, unknown>>;
    };
    const quizLookupProjection = quizzesLookup.pipeline.find((stage) => '$project' in stage)?.[
      '$project'
    ] as Record<string, unknown> | undefined;
    expect(quizLookupProjection).toMatchObject({
      questionCount: { $size: { $ifNull: ['$questions', []] } },
    });
    expect(quizLookupProjection).not.toHaveProperty('questions');

    const stagesAfterQuizLookup = pipeline.slice(6);
    expect(stagesAfterQuizLookup.some((stage) => JSON.stringify(stage).includes('questions'))).toBe(
      false,
    );
    expect(
      stagesAfterQuizLookup.some(
        (stage) => stage['$project'] && 'questions' in (stage['$project'] as object),
      ),
    ).toBe(false);
    expect(
      stagesAfterQuizLookup.some(
        (stage) =>
          stage['$addFields'] &&
          typeof stage['$addFields'] === 'object' &&
          stage['$addFields'] !== null &&
          'questionCount' in (stage['$addFields'] as object),
      ),
    ).toBe(false);

    const replaceRootIndex = pipeline.findIndex((stage) => '$replaceRoot' in stage);
    const folderLookupIndex = pipeline.findIndex(
      (stage) => (stage['$lookup'] as { from?: string } | undefined)?.from === 'folderquizzes',
    );
    // Nothing between merge and folder lookup — questions never ride the pipeline.
    expect(pipeline.slice(replaceRootIndex + 1, folderLookupIndex)).toEqual([]);
  });

  it('projects only DTO quiz fields and required author fields in nested lookups', async () => {
    await new LearningProgressRepository().listLibraryQuizzes('507f191e810c19729de860ea', {
      page: 1,
      limit: 20,
    });

    const pipeline = modelMocks.quizAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    const quizzesLookup = pipeline.find(
      (stage) => (stage['$lookup'] as { from?: string } | undefined)?.from === 'quizzes',
    )?.['$lookup'] as { pipeline: Array<Record<string, unknown>> } | undefined;
    const usersLookup = pipeline.find(
      (stage) => (stage['$lookup'] as { from?: string } | undefined)?.from === 'users',
    )?.['$lookup'] as { pipeline: Array<Record<string, unknown>> } | undefined;
    expect(quizzesLookup).toBeDefined();
    expect(usersLookup).toBeDefined();

    const quizProjection = quizzesLookup?.pipeline.find((stage) => '$project' in stage)?.[
      '$project'
    ] as Record<string, unknown> | undefined;
    expect(quizProjection).toBeDefined();
    expect(Object.keys(quizProjection ?? {}).sort()).toEqual(
      [
        '_id',
        'author',
        'createdAt',
        'description',
        'folder',
        'isPrivate',
        'pdfUrl',
        'questionCount',
        'slug',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(quizProjection?.['questions']).toBeUndefined();
    expect(quizProjection?.['questionCount']).toEqual({
      $size: { $ifNull: ['$questions', []] },
    });

    const authorProjection = usersLookup?.pipeline.find((stage) => '$project' in stage)?.[
      '$project'
    ] as Record<string, unknown> | undefined;
    expect(authorProjection).toBeDefined();
    expect(Object.keys(authorProjection ?? {}).sort()).toEqual(
      ['_id', 'avatar', 'displayName', 'email', 'name'].sort(),
    );

    // Post-lookup stages reference questionCount only as a pass-through field, never questions.
    const replaceRootIndex = pipeline.findIndex((stage) => '$replaceRoot' in stage);
    expect(replaceRootIndex).toBeGreaterThanOrEqual(0);
    const serializedAfterLookups = JSON.stringify(pipeline.slice(replaceRootIndex));
    expect(serializedAfterLookups).toContain('"questionCount":1');
    expect(serializedAfterLookups).not.toMatch(/"questions"/);
  });

  it('returns empty pagination for invalid user ids without aggregating', async () => {
    const repository = new LearningProgressRepository();
    await expect(
      repository.listLibraryQuizzes('not-an-object-id', { page: 2, limit: 10 }),
    ).resolves.toEqual({
      items: [],
      pagination: {
        currentPage: 2,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });
    expect(modelMocks.quizAggregate).not.toHaveBeenCalled();
  });

  it('applies folder filters and page offsets, and maps null activity timestamps', async () => {
    const folderId = '507f191e810c19729de860eb';
    const quizId = '507f191e810c19729de860ec';
    modelMocks.quizAggregate.mockResolvedValueOnce([
      {
        items: [
          {
            _id: quizId,
            title: 'Owned quiz',
            slug: 'owned-quiz',
            author: { _id: '507f191e810c19729de860ea', email: 'author@example.com' },
            folder: folderId,
            isPrivate: false,
            questionCount: 2,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
            updatedAt: new Date('2026-07-02T00:00:00.000Z'),
            lastAttemptAt: undefined,
            lastProgressAt: undefined,
          },
        ],
        meta: [{ totalItems: 1 }],
      },
    ]);

    const result = await new LearningProgressRepository().listLibraryQuizzes(
      '507f191e810c19729de860ea',
      { page: 3, limit: 5, folder: folderId },
    );

    expect(result.pagination).toMatchObject({
      currentPage: 3,
      totalItems: 1,
      itemsPerPage: 5,
    });
    expect(result.items[0]).toMatchObject({
      slug: 'owned-quiz',
      lastAttemptAt: null,
      lastProgressAt: null,
      folder: folderId,
    });

    const pipeline = modelMocks.quizAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(pipeline).toContainEqual({
      $match: { effectiveFolder: expect.any(mongoose.Types.ObjectId) },
    });
    expect(pipeline).toContainEqual({
      $facet: expect.objectContaining({
        items: expect.arrayContaining([{ $skip: 10 }, { $limit: 5 }]),
      }),
    });
  });

  it('matches unfiled quizzes when folder is an empty string', async () => {
    await new LearningProgressRepository().listLibraryQuizzes('507f191e810c19729de860ea', {
      page: 1,
      limit: 10,
      folder: '',
    });
    const pipeline = modelMocks.quizAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(pipeline).toContainEqual({ $match: { effectiveFolder: null } });
  });

  it('treats missing aggregate facets as empty library results', async () => {
    modelMocks.quizAggregate.mockResolvedValueOnce([undefined]);
    await expect(
      new LearningProgressRepository().listLibraryQuizzes('507f191e810c19729de860ea', {
        page: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      items: [],
      pagination: { totalItems: 0 },
    });
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
    expect(modelMocks.questionFindOne).toHaveBeenCalledWith({
      userId: 'user-1',
      quizSlug: 'architecture',
      questionId: 'question-1',
    });
    await expect(repository.findUserProgress('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      totalXp: 100,
    });
    expect(modelMocks.userFindOne).toHaveBeenCalledWith({ userId: 'user-1' });

    modelMocks.questionFindOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    modelMocks.userFindOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    await expect(
      repository.findQuestionProgress('user-1', 'architecture', 'missing'),
    ).resolves.toBeNull();
    await expect(repository.findUserProgress('missing')).resolves.toBeNull();

    const defaults = repository.createDefaultUserProgress('user-2');
    expect(defaults).toMatchObject({
      userId: 'user-2',
      currentStreak: 0,
      longestStreak: 0,
      streakFreezeCount: 0,
      totalXp: 0,
      totalQuestionsLearned: 0,
      totalQuizzesTaken: 0,
      totalReviewSessions: 0,
      lastSessionDate: null,
      averageAccuracy: 0,
    });
    expect(defaults.weeklyActivity).toBeInstanceOf(Map);

    await expect(
      repository.saveQuestionProgress({
        userId: 'user-1',
        quizSlug: 'architecture',
        questionId: 'question-1',
        questionRef: {
          text: 'What is 2+2?',
          options: ['3', '4'],
          correctIndexes: [1],
        },
        srsLevel: 1,
        nextReviewDate: now,
        lastReviewDate: null,
        interval: 1,
        easeFactor: 2.5,
        correctStreak: 1,
        totalReviews: 1,
        totalCorrect: 1,
        history: [],
        isBookmarked: true,
        notes: 'keep',
      }),
    ).resolves.toMatchObject({ questionId: 'question-1' });

    expect(modelMocks.questionFindOneAndUpdate).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        quizSlug: 'architecture',
        questionId: 'question-1',
      },
      {
        $set: expect.objectContaining({
          questionRef: {
            text: 'What is 2+2?',
            options: ['3', '4'],
            correctIndexes: [1],
          },
          srsLevel: 1,
          isBookmarked: true,
          notes: 'keep',
        }),
        $setOnInsert: {
          userId: 'user-1',
          quizSlug: 'architecture',
          questionId: 'question-1',
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await expect(
      repository.saveQuestionProgress({
        userId: 'user-1',
        quizSlug: 'architecture',
        questionId: 'question-2',
        srsLevel: 0,
        nextReviewDate: now,
        lastReviewDate: null,
        interval: 0,
        easeFactor: 2.5,
        correctStreak: 0,
        totalReviews: 0,
        totalCorrect: 0,
        history: [],
      }),
    ).resolves.toMatchObject({ questionId: 'question-1' });
    const omittedOptionalUpdate = modelMocks.questionFindOneAndUpdate.mock.calls.at(-1)?.[1] as {
      $set: Record<string, unknown>;
    };
    expect(omittedOptionalUpdate.$set).not.toHaveProperty('questionRef');
    expect(omittedOptionalUpdate.$set).not.toHaveProperty('isBookmarked');
    expect(omittedOptionalUpdate.$set).not.toHaveProperty('notes');

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
    expect(modelMocks.userFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      {
        $set: expect.objectContaining({
          currentStreak: 1,
          lastSessionDate: now,
          totalXp: 100,
        }),
      },
      { new: true, upsert: true, runValidators: true },
    );

    await expect(
      repository.saveUserProgress({
        userId: 'user-1',
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: now,
        streakFreezeCount: 0,
        totalXp: 0,
        totalQuestionsLearned: 0,
        totalQuizzesTaken: 0,
        totalReviewSessions: 0,
        averageAccuracy: 0,
        weeklyActivity: new Map(),
      }),
    ).resolves.toMatchObject({ userId: 'user-1' });
    const omittedSessionUpdate = modelMocks.userFindOneAndUpdate.mock.calls.at(-1)?.[1] as {
      $set: Record<string, unknown>;
    };
    expect(omittedSessionUpdate.$set).not.toHaveProperty('lastSessionDate');
  });

  it('ends the review-progress session and fails closed when the transaction does not commit', async () => {
    const withTransaction = vi.fn().mockResolvedValue(undefined);
    const endSession = vi.fn();
    const session: ClientSession = Object.assign(Object.create(null), {
      withTransaction,
      endSession,
    });
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    await expect(
      new LearningProgressRepository().mutateReviewProgress(
        'user-1',
        'architecture',
        'question-1',
        () => {
          throw new Error('should not run');
        },
      ),
    ).rejects.toThrow('Review progress transaction did not commit');
    expect(endSession).toHaveBeenCalledOnce();
  });

  it('throws when save operations do not return a persisted document', async () => {
    modelMocks.questionFindOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null),
    });
    modelMocks.userFindOneAndUpdate.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null),
    });
    const repository = new LearningProgressRepository();

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
      }),
    ).rejects.toThrow('Failed to save question progress');

    await expect(
      repository.saveUserProgress({
        userId: 'user-1',
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: now,
        streakFreezeCount: 0,
        totalXp: 1,
        totalQuestionsLearned: 0,
        totalQuizzesTaken: 0,
        totalReviewSessions: 0,
        averageAccuracy: 0,
        weeklyActivity: new Map(),
      }),
    ).rejects.toThrow('Failed to save user progress');
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
