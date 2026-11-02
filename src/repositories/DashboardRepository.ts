import connectDB from '@/lib/mongoose';
import { Types } from 'mongoose';
import AttemptModel from '@/models/Attempt';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import QuizModel from '@/models/Quiz';
import QuestionProgress from '@/models/QuestionProgress';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type {
  DashboardInProgressQuizRecord,
  DashboardStarterQuizCandidateRecord,
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

  async hasSubmittedAttempt(userId: string): Promise<boolean> {
    await connectDB();
    // Served by the { user: 1, takenAt: -1 } index; exists() stops at the first match.
    return (await AttemptModel.exists({ user: userId })) !== null;
  }

  async hasAuthoredQuiz(userId: string): Promise<boolean> {
    await connectDB();
    // Served by the { author: 1, createdAt: -1 } index.
    return (await QuizModel.exists({ author: userId })) !== null;
  }

  async findStarterQuizCandidates(slugs: string[]): Promise<DashboardStarterQuizCandidateRecord[]> {
    if (slugs.length === 0) return [];
    await connectDB();
    // One round trip on the unique slug index. Question bodies never leave the
    // database: only their count is projected. The lookup mirrors the premium
    // gate on /quiz/[slug] (an active, approved publication of this quiz).
    return QuizModel.aggregate<DashboardStarterQuizCandidateRecord>([
      { $match: { slug: { $in: slugs } } },
      {
        $lookup: {
          from: PremiumQuizSubmissionModel.collection.collectionName,
          localField: '_id',
          foreignField: 'sourceQuiz',
          pipeline: [{ $match: { status: 'approved', active: true } }, { $project: { _id: 1 } }],
          as: 'premiumPublications',
        },
      },
      {
        $project: {
          _id: 0,
          slug: 1,
          title: 1,
          visibility: 1,
          questionCount: { $size: { $ifNull: ['$questions', []] } },
          isPremium: { $gt: [{ $size: '$premiumPublications' }, 0] },
        },
      },
    ]);
  }
}
