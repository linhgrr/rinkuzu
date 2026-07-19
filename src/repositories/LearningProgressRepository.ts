import mongoose, { Types, type UpdateQuery } from 'mongoose';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import UserProgress from '@/models/UserProgress';
import type {
  ILearningProgressRepository,
  LibraryQuizListOptions,
  ReviewProgressMutation,
  ReviewProgressTransactionResult,
} from '@/interfaces/repositories/ILearningProgressRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import type {
  LibraryQuiz,
  QuestionReviewProgress,
  QuestionReviewProgressDraft,
  UserLearningProgress,
  StreakFreezePurchaseOptions,
  StreakFreezePurchaseResult,
} from '@/entities/LearningProgress';
import { LearningProgressPersistenceMapper } from '@/repositories/mappers/LearningProgressPersistenceMapper';
import type {
  LibraryQuizPersistenceRecord,
  QuestionProgressPersistenceRecord,
  UserProgressPersistenceRecord,
} from '@/repositories/types/LearningProgressPersistence';
import { buildPaginationMeta } from '@/lib/pagination';
import {
  retainRecentReviewHistory,
  retainRecentWeeklyActivity,
} from '@/lib/learning-progress-retention.mjs';

type LibraryQuizAggregateRecord = LibraryQuizPersistenceRecord & {
  lastAttemptAt?: Date;
  lastProgressAt?: Date;
};
type LibraryQuizFacetMeta = {
  totalItems: number;
};
type LibraryQuizFacetResult = {
  items: LibraryQuizAggregateRecord[];
  meta: LibraryQuizFacetMeta[];
};

function questionProgressUpdate(
  progress: QuestionReviewProgressDraft,
): UpdateQuery<QuestionProgressPersistenceRecord> {
  return {
    $set: {
      ...(progress.questionRef !== undefined ? { questionRef: progress.questionRef } : {}),
      srsLevel: progress.srsLevel,
      nextReviewDate: progress.nextReviewDate,
      lastReviewDate: progress.lastReviewDate,
      interval: progress.interval,
      easeFactor: progress.easeFactor,
      correctStreak: progress.correctStreak,
      totalReviews: progress.totalReviews,
      totalCorrect: progress.totalCorrect,
      history: retainRecentReviewHistory(progress.history),
      ...(progress.isBookmarked !== undefined ? { isBookmarked: progress.isBookmarked } : {}),
      ...(progress.notes !== undefined ? { notes: progress.notes } : {}),
    },
    $setOnInsert: {
      userId: progress.userId,
      quizSlug: progress.quizSlug,
      questionId: progress.questionId,
    },
  };
}

function userProgressUpdate(
  progress: UserLearningProgress,
): UpdateQuery<UserProgressPersistenceRecord> {
  return {
    $set: {
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      lastActiveDate: progress.lastActiveDate,
      streakFreezeCount: progress.streakFreezeCount,
      totalXp: progress.totalXp,
      totalQuestionsLearned: progress.totalQuestionsLearned,
      totalQuizzesTaken: progress.totalQuizzesTaken,
      totalReviewSessions: progress.totalReviewSessions,
      ...(progress.lastSessionDate !== undefined
        ? { lastSessionDate: progress.lastSessionDate }
        : {}),
      averageAccuracy: progress.averageAccuracy,
      weeklyActivity: retainRecentWeeklyActivity(progress.weeklyActivity, progress.lastActiveDate),
    },
  };
}

export class LearningProgressRepository implements ILearningProgressRepository {
  async listLibraryQuizzes(
    userId: string,
    options: LibraryQuizListOptions,
  ): Promise<PaginatedRepositoryResult<LibraryQuiz>> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId)) {
      return {
        items: [],
        pagination: buildPaginationMeta(options.page, options.limit, 0),
      };
    }

    const userObjectId = new Types.ObjectId(userId);
    const skip = (options.page - 1) * options.limit;

    const folderMatch =
      options.folder === undefined
        ? []
        : [
            {
              $match: {
                effectiveFolder: options.folder ? new Types.ObjectId(options.folder) : null,
              },
            },
          ];

    const [result] = await Quiz.aggregate<LibraryQuizFacetResult>([
      { $match: { author: userObjectId } },
      {
        $project: {
          _id: 1,
          lastAttemptAt: { $literal: null },
          lastProgressAt: { $literal: null },
        },
      },
      {
        $unionWith: {
          coll: 'attempts',
          pipeline: [
            { $match: { user: userObjectId } },
            { $group: { _id: '$quiz', lastAttemptAt: { $max: '$takenAt' } } },
            {
              $project: {
                lastAttemptAt: 1,
                lastProgressAt: { $literal: null },
              },
            },
          ],
        },
      },
      {
        $unionWith: {
          coll: 'quizprogresses',
          pipeline: [
            { $match: { userId: userObjectId } },
            { $group: { _id: '$quiz', lastProgressAt: { $max: '$updatedAt' } } },
            {
              $project: {
                lastAttemptAt: { $literal: null },
                lastProgressAt: 1,
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: '$_id',
          lastAttemptAt: { $max: '$lastAttemptAt' },
          lastProgressAt: { $max: '$lastProgressAt' },
        },
      },
      {
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
      },
      { $unwind: '$quiz' },
      {
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
      },
      {
        $lookup: {
          from: 'folderquizzes',
          let: { quizId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$quiz', '$$quizId'] }, { $eq: ['$owner', userObjectId] }],
                },
              },
            },
            { $project: { _id: 0, folder: 1 } },
            { $limit: 1 },
          ],
          as: 'folderLinks',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                displayName: 1,
                avatar: 1,
              },
            },
          ],
          as: 'authorDoc',
        },
      },
      {
        $addFields: {
          authorDoc: { $first: '$authorDoc' },
          ownedByMe: { $eq: ['$author', userObjectId] },
          externalFolder: { $first: '$folderLinks.folder' },
        },
      },
      {
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
      },
      ...folderMatch,
      { $sort: { displayDateSort: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: options.limit },
            {
              $project: {
                _id: 1,
                title: 1,
                slug: 1,
                description: 1,
                author: {
                  _id: { $ifNull: ['$authorDoc._id', '$author'] },
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
      },
    ]);

    const items = result?.items ?? [];
    const totalItems = result?.meta[0]?.totalItems ?? 0;

    return {
      items: items.map((quiz) =>
        LearningProgressPersistenceMapper.toLibraryQuiz(quiz, {
          userId,
          linkedFolderId: quiz.folder ? String(quiz.folder) : null,
          lastAttemptAt: quiz.lastAttemptAt ?? null,
          lastProgressAt: quiz.lastProgressAt ?? null,
        }),
      ),
      pagination: buildPaginationMeta(options.page, options.limit, totalItems),
    };
  }

  async listDueQuestions(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<QuestionReviewProgress[]> {
    await connectDB();
    const dueQuestions = await QuestionProgress.find({
      userId,
      nextReviewDate: { $lte: now },
    })
      .sort({ nextReviewDate: 1 })
      .limit(limit)
      .lean<QuestionProgressPersistenceRecord[]>();

    return dueQuestions.map((question) =>
      LearningProgressPersistenceMapper.toQuestionProgress(question),
    );
  }

  async findQuestionProgress(
    userId: string,
    quizSlug: string,
    questionId: string,
  ): Promise<QuestionReviewProgress | null> {
    await connectDB();
    const progress = await QuestionProgress.findOne({
      userId,
      quizSlug,
      questionId,
    }).lean<QuestionProgressPersistenceRecord>();
    return progress ? LearningProgressPersistenceMapper.toQuestionProgress(progress) : null;
  }

  async saveQuestionProgress(
    progress: QuestionReviewProgressDraft,
  ): Promise<QuestionReviewProgress> {
    await connectDB();
    const saved = await QuestionProgress.findOneAndUpdate(
      {
        userId: progress.userId,
        quizSlug: progress.quizSlug,
        questionId: progress.questionId,
      },
      questionProgressUpdate(progress),
      { new: true, upsert: true, runValidators: true },
    ).lean<QuestionProgressPersistenceRecord>();

    if (!saved) throw new Error('Failed to save question progress');
    return LearningProgressPersistenceMapper.toQuestionProgress(saved);
  }

  async findUserProgress(userId: string): Promise<UserLearningProgress | null> {
    await connectDB();
    const progress = await UserProgress.findOne({ userId }).lean<UserProgressPersistenceRecord>();
    return progress ? LearningProgressPersistenceMapper.toUserProgress(progress) : null;
  }

  createDefaultUserProgress(userId: string): UserLearningProgress {
    const now = new Date();
    return {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: now,
      streakFreezeCount: 0,
      totalXp: 0,
      totalQuestionsLearned: 0,
      totalQuizzesTaken: 0,
      totalReviewSessions: 0,
      lastSessionDate: null,
      averageAccuracy: 0,
      weeklyActivity: new Map(),
    };
  }

  async saveUserProgress(progress: UserLearningProgress): Promise<UserLearningProgress> {
    await connectDB();
    const saved = await UserProgress.findOneAndUpdate(
      { userId: progress.userId },
      userProgressUpdate(progress),
      { new: true, upsert: true, runValidators: true },
    ).lean<UserProgressPersistenceRecord>();

    if (!saved) throw new Error('Failed to save user progress');
    return LearningProgressPersistenceMapper.toUserProgress(saved);
  }

  async mutateReviewProgress(
    userId: string,
    quizSlug: string,
    questionId: string,
    mutate: (
      questionProgress: QuestionReviewProgress | null,
      userProgress: UserLearningProgress | null,
    ) => ReviewProgressMutation,
  ): Promise<ReviewProgressTransactionResult> {
    await connectDB();
    const session = await mongoose.startSession();
    let result: ReviewProgressTransactionResult | null = null;

    try {
      await session.withTransaction(async () => {
        // Sequential on purpose: withTransaction forbids Promise.all (architecture check).
        const questionRecord = await QuestionProgress.findOne({ userId, quizSlug, questionId })
          .session(session)
          .lean<QuestionProgressPersistenceRecord>();
        const userRecord = await UserProgress.findOne({ userId })
          .session(session)
          .lean<UserProgressPersistenceRecord>();

        const mutation = mutate(
          questionRecord
            ? LearningProgressPersistenceMapper.toQuestionProgress(questionRecord)
            : null,
          userRecord ? LearningProgressPersistenceMapper.toUserProgress(userRecord) : null,
        );

        const savedQuestion = await QuestionProgress.findOneAndUpdate(
          {
            userId: mutation.questionProgress.userId,
            quizSlug: mutation.questionProgress.quizSlug,
            questionId: mutation.questionProgress.questionId,
          },
          questionProgressUpdate(mutation.questionProgress),
          { new: true, upsert: true, runValidators: true, session },
        ).lean<QuestionProgressPersistenceRecord>();
        if (!savedQuestion) throw new Error('Failed to save question progress');

        const savedUser = await UserProgress.findOneAndUpdate(
          { userId: mutation.userProgress.userId },
          userProgressUpdate(mutation.userProgress),
          { new: true, upsert: true, runValidators: true, session },
        ).lean<UserProgressPersistenceRecord>();
        if (!savedUser) throw new Error('Failed to save user progress');

        result = {
          questionProgress: LearningProgressPersistenceMapper.toQuestionProgress(savedQuestion),
          userProgress: LearningProgressPersistenceMapper.toUserProgress(savedUser),
          streakFreezeUsed: mutation.streakFreezeUsed,
        };
      });
    } finally {
      await session.endSession();
    }

    if (!result) throw new Error('Review progress transaction did not commit');
    return result;
  }

  async buyStreakFreeze(
    userId: string,
    options: StreakFreezePurchaseOptions,
  ): Promise<StreakFreezePurchaseResult> {
    await connectDB();

    const filter = {
      userId,
      totalXp: { $gte: options.cost },
      streakFreezeCount: { $lt: options.maxFreezes },
    };
    const update = {
      $inc: { totalXp: -options.cost, streakFreezeCount: 1 },
    };
    const updateOptions = { new: true, runValidators: true };

    // Atomic eligibility + spend so concurrent purchases cannot overspend XP or exceed max freezes.
    // At most two attempts: on miss, classify; retry once only if still eligible (transient race).
    for (let attempt = 1; attempt <= 2; attempt++) {
      const updated = await UserProgress.findOneAndUpdate(filter, update, updateOptions).select(
        'totalXp streakFreezeCount',
      );

      if (updated) {
        return {
          status: 'purchased' as const,
          xp: updated.totalXp,
          streakFreezeCount: updated.streakFreezeCount,
        };
      }

      // Read-only classification when the atomic filter misses (no write on failure paths).
      const progress = await UserProgress.findOne({ userId }).select('totalXp streakFreezeCount');
      if (!progress) return { status: 'not_found' as const };
      if (progress.streakFreezeCount >= options.maxFreezes) {
        return { status: 'max_freezes' as const };
      }
      if (progress.totalXp < options.cost) return { status: 'not_enough_xp' as const };

      // Still eligible after miss — retry once; after second miss, fail closed (no false status).
      if (attempt === 2) {
        throw new Error(
          'Streak freeze purchase conflict: still eligible after repeated atomic update misses',
        );
      }
    }

    throw new Error(
      'Streak freeze purchase conflict: still eligible after repeated atomic update misses',
    );
  }

  async countLearnedQuestions(userId: string): Promise<number> {
    await connectDB();
    return QuestionProgress.countDocuments({
      userId,
      srsLevel: { $gt: 0 },
    });
  }

  async updateTotalQuestionsLearned(userId: string, totalQuestionsLearned: number): Promise<void> {
    await connectDB();
    await UserProgress.updateOne({ userId }, { totalQuestionsLearned });
  }
}
