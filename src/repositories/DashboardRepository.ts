import connectDB from '@/lib/mongoose';
import { Types } from 'mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type {
  DashboardInProgressQuizRecord,
  DashboardUserProgressRecord,
  IDashboardRepository,
} from '@/interfaces/repositories/IDashboardRepository';
import { serializeId } from '@/lib/mongo-id';
import type {
  DashboardProgressPersistenceRecord,
  DashboardUserProgressPersistenceRecord,
} from '@/repositories/types/DashboardPersistence';

function toWeeklyActivityRecord(
  activity: DashboardUserProgressPersistenceRecord['weeklyActivity'],
): DashboardUserProgressRecord['weeklyActivity'] {
  if (activity instanceof Map) {
    return Object.fromEntries(activity);
  }
  return activity;
}

export class DashboardRepository implements IDashboardRepository {
  async findUserProgress(userId: string): Promise<DashboardUserProgressRecord | null> {
    await connectDB();
    const projection =
      'currentStreak longestStreak streakFreezeCount totalXp weeklyActivity totalQuestionsLearned totalReviewSessions averageAccuracy';
    const progress = await UserProgress.findOne({ userId })
      .select(projection)
      .lean<DashboardUserProgressPersistenceRecord>()
      .exec();
    if (!progress) return null;

    return {
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      streakFreezeCount: progress.streakFreezeCount,
      totalXp: progress.totalXp,
      weeklyActivity: toWeeklyActivityRecord(progress.weeklyActivity),
      totalQuestionsLearned: progress.totalQuestionsLearned,
      totalReviewSessions: progress.totalReviewSessions,
      averageAccuracy: progress.averageAccuracy,
    };
  }

  async countDueQuestions(userId: string, now: Date): Promise<number> {
    await connectDB();
    return QuestionProgress.countDocuments({
      userId,
      nextReviewDate: { $lte: now },
    });
  }

  async findInProgressQuizzes(
    userId: string,
    limit: number,
  ): Promise<DashboardInProgressQuizRecord[]> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }
    const records = await QuizProgress.find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate({ path: 'quiz', select: 'title slug' })
      .lean<DashboardProgressPersistenceRecord[]>();

    return records.flatMap((record) => {
      if (!record.quiz) return [];
      return [
        {
          quizId: serializeId(record.quiz._id, 'quiz._id'),
          title: record.quiz.title,
          slug: record.quiz.slug,
          answeredCount: record.answeredCount,
          totalQuestions: record.totalQuestions,
          updatedAt: record.updatedAt,
        },
      ];
    });
  }
}
