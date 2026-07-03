import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type {
  ILearningProgressRepository,
  LibraryQuizListOptions,
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

type AttemptSummary = { _id: Types.ObjectId; lastAttemptAt: Date };
type ProgressSummary = { _id: Types.ObjectId; lastProgressAt: Date };
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

    const [attempts, progressRecords] = await Promise.all([
      Attempt.aggregate<AttemptSummary>([
        { $match: { user: userObjectId } },
        { $group: { _id: '$quiz', lastAttemptAt: { $max: '$takenAt' } } },
      ]),
      QuizProgress.aggregate<ProgressSummary>([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$quiz', lastProgressAt: { $max: '$updatedAt' } } },
      ]),
    ]);

    const attemptedIds = attempts.map((attempt) => attempt._id);
    const inProgressIds = progressRecords.map((progress) => progress._id);
    const activityQuizIds = [
      ...new Map(
        [...attemptedIds, ...inProgressIds].map((quizId) => [String(quizId), quizId]),
      ).values(),
    ];

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
      {
        $match: {
          $or: [{ author: userObjectId }, { _id: { $in: activityQuizIds } }],
        },
      },
      {
        $lookup: {
          from: 'attempts',
          let: { quizId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$quiz', '$$quizId'] }, { $eq: ['$user', userObjectId] }],
                },
              },
            },
            { $group: { _id: '$quiz', lastAttemptAt: { $max: '$takenAt' } } },
          ],
          as: 'attemptStats',
        },
      },
      {
        $lookup: {
          from: 'quizprogresses',
          let: { quizId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$quiz', '$$quizId'] }, { $eq: ['$userId', userObjectId] }],
                },
              },
            },
            { $group: { _id: '$quiz', lastProgressAt: { $max: '$updatedAt' } } },
          ],
          as: 'progressStats',
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
          as: 'authorDoc',
        },
      },
      {
        $addFields: {
          authorDoc: { $first: '$authorDoc' },
          lastAttemptAt: { $first: '$attemptStats.lastAttemptAt' },
          lastProgressAt: { $first: '$progressStats.lastProgressAt' },
          ownedByMe: { $eq: ['$author', userObjectId] },
          externalFolder: { $first: '$folderLinks.folder' },
          questionCount: { $size: { $ifNull: ['$questions', []] } },
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
      {
        $set: {
          questionRef: progress.questionRef,
          srsLevel: progress.srsLevel,
          nextReviewDate: progress.nextReviewDate,
          lastReviewDate: progress.lastReviewDate,
          interval: progress.interval,
          easeFactor: progress.easeFactor,
          correctStreak: progress.correctStreak,
          totalReviews: progress.totalReviews,
          totalCorrect: progress.totalCorrect,
          history: progress.history,
          isBookmarked: progress.isBookmarked,
          notes: progress.notes,
        },
        $setOnInsert: {
          userId: progress.userId,
          quizSlug: progress.quizSlug,
          questionId: progress.questionId,
        },
      },
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
      {
        $set: {
          currentStreak: progress.currentStreak,
          longestStreak: progress.longestStreak,
          lastActiveDate: progress.lastActiveDate,
          streakFreezeCount: progress.streakFreezeCount,
          totalXp: progress.totalXp,
          totalQuestionsLearned: progress.totalQuestionsLearned,
          totalQuizzesTaken: progress.totalQuizzesTaken,
          totalReviewSessions: progress.totalReviewSessions,
          lastSessionDate: progress.lastSessionDate,
          averageAccuracy: progress.averageAccuracy,
          weeklyActivity: progress.weeklyActivity,
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean<UserProgressPersistenceRecord>();

    if (!saved) throw new Error('Failed to save user progress');
    return LearningProgressPersistenceMapper.toUserProgress(saved);
  }

  async buyStreakFreeze(
    userId: string,
    options: StreakFreezePurchaseOptions,
  ): Promise<StreakFreezePurchaseResult> {
    await connectDB();
    const progress = await UserProgress.findOne({ userId }).select('totalXp streakFreezeCount');
    if (!progress) return { status: 'not_found' as const };
    if (progress.streakFreezeCount >= options.maxFreezes) return { status: 'max_freezes' as const };
    if (progress.totalXp < options.cost) return { status: 'not_enough_xp' as const };

    progress.totalXp -= options.cost;
    progress.streakFreezeCount += 1;
    await progress.save();

    return {
      status: 'purchased' as const,
      xp: progress.totalXp,
      streakFreezeCount: progress.streakFreezeCount,
    };
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
