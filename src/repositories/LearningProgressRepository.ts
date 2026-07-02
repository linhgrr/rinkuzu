import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import FolderQuiz from '@/models/FolderQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type { ILearningProgressRepository } from '@/interfaces/repositories/ILearningProgressRepository';
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

type AttemptSummary = { _id: Types.ObjectId; lastAttemptAt: Date };
type ProgressSummary = { _id: Types.ObjectId; lastProgressAt: Date };

export class LearningProgressRepository implements ILearningProgressRepository {
  async listLibraryQuizzes(userId: string): Promise<LibraryQuiz[]> {
    await connectDB();
    const userObjectId = new Types.ObjectId(userId);

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
    const [quizDocuments, folderLinks] = await Promise.all([
      Quiz.find({
        $or: [{ author: userObjectId }, { _id: { $in: [...attemptedIds, ...inProgressIds] } }],
      })
        .populate('author', 'email name displayName avatar')
        .lean<LibraryQuizPersistenceRecord[]>(),
      FolderQuiz.find({ owner: userObjectId }).lean<
        Array<{
          quiz: Types.ObjectId;
          folder: Types.ObjectId;
        }>
      >(),
    ]);

    const lastAttemptByQuiz = new Map(
      attempts.map((attempt) => [String(attempt._id), attempt.lastAttemptAt]),
    );
    const lastProgressByQuiz = new Map(
      progressRecords.map((progress) => [String(progress._id), progress.lastProgressAt]),
    );
    const linkedFolderByQuiz = new Map(
      folderLinks.map((link) => [String(link.quiz), String(link.folder)]),
    );

    return quizDocuments.map((quiz) =>
      LearningProgressPersistenceMapper.toLibraryQuiz(quiz, {
        userId,
        linkedFolderId: linkedFolderByQuiz.get(String(quiz._id)) ?? null,
        lastAttemptAt: lastAttemptByQuiz.get(String(quiz._id)) ?? null,
        lastProgressAt: lastProgressByQuiz.get(String(quiz._id)) ?? null,
      }),
    );
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
