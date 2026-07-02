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
import type {
  DashboardProgressPersistenceRecord,
  DashboardUserProgressPersistenceRecord,
} from '@/repositories/types/DashboardPersistence';
import { DashboardPersistenceMapper } from '@/repositories/mappers/DashboardPersistenceMapper';

export class DashboardRepository implements IDashboardRepository {
  async findUserProgress(userId: string): Promise<DashboardUserProgressRecord | null> {
    await connectDB();
    const projection =
      'currentStreak longestStreak streakFreezeCount totalXp weeklyActivity totalQuestionsLearned totalReviewSessions averageAccuracy';
    const progress = await UserProgress.findOne({ userId })
      .select(projection)
      .lean<DashboardUserProgressPersistenceRecord>()
      .exec();
    return progress ? DashboardPersistenceMapper.toUserProgress(progress) : null;
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
      const mapped = DashboardPersistenceMapper.toInProgressQuiz(record);
      return mapped ? [mapped] : [];
    });
  }
}
