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
    const records = await QuizProgress.aggregate<DashboardProgressPersistenceRecord>([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, title: 1, slug: 1 } }],
          as: 'quizDoc',
        },
      },
      { $unwind: '$quizDoc' },
      {
        $project: {
          answeredCount: 1,
          totalQuestions: 1,
          updatedAt: 1,
          quiz: {
            _id: '$quizDoc._id',
            title: '$quizDoc.title',
            slug: '$quizDoc.slug',
          },
        },
      },
    ]);

    return records.flatMap((record) => {
      const mapped = DashboardPersistenceMapper.toInProgressQuiz(record);
      return mapped ? [mapped] : [];
    });
  }
}
