import connectDB from '@/lib/mongoose';
import { Types } from 'mongoose';
import AttemptModel from '@/models/Attempt';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import QuizModel from '@/models/Quiz';
import StarterQuizModel from '@/models/StarterQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type {
  DashboardInProgressQuizRecord,
  DashboardUserProgressRecord,
  IDashboardRepository,
} from '@/interfaces/repositories/IDashboardRepository';
import type {
  IQuizCandidateBySlugRepository,
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
  StarterQuizEntryRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import type {
  DashboardProgressPersistenceRecord,
  DashboardUserProgressPersistenceRecord,
} from '@/repositories/types/DashboardPersistence';
import { DashboardPersistenceMapper } from '@/repositories/mappers/DashboardPersistenceMapper';
import { QUIZ_INDEX_BLOCK_PROJECTION } from '@/repositories/quiz-index-filter';

interface StarterQuizEntryPersistence {
  quiz: Types.ObjectId;
  locale: string;
  order: number;
}

type StarterQuizCandidatePersistence = Omit<StarterQuizCandidateRecord, 'quizId'> & {
  _id: Types.ObjectId;
};

export class DashboardRepository
  implements IDashboardRepository, IStarterQuizReadRepository, IQuizCandidateBySlugRepository
{
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

  async listStarterQuizEntries(): Promise<StarterQuizEntryRecord[]> {
    await connectDB();
    // A handful of admin-curated rows, read in order on the { order: 1 } index.
    const rows = await StarterQuizModel.find({}, { _id: 0, quiz: 1, locale: 1, order: 1 })
      .sort({ order: 1 })
      .lean<StarterQuizEntryPersistence[]>()
      .exec();
    return rows.map((row) => ({
      quizId: row.quiz.toString(),
      locale: row.locale,
      order: row.order,
    }));
  }

  async findStarterQuizCandidates(quizIds: string[]): Promise<StarterQuizCandidateRecord[]> {
    const ids = quizIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return [];
    return this.aggregateQuizCandidates({ _id: { $in: ids } });
  }

  /**
   * The blog card's quiz (RIN-1258): same eligibility fields, looked up by its
   * slug or a former one (RIN-624), so a renamed quiz still opens.
   */
  async findQuizCandidateBySlug(slug: string): Promise<StarterQuizCandidateRecord | null> {
    const [candidate] = await this.aggregateQuizCandidates({
      $or: [{ slug }, { slugAliases: slug }],
    });
    return candidate ?? null;
  }

  private async aggregateQuizCandidates(
    match: Record<string, unknown>,
  ): Promise<StarterQuizCandidateRecord[]> {
    await connectDB();
    // One round trip. Question bodies never leave the
    // database: only their count is projected. The lookup mirrors the premium
    // gate on /quiz/[slug] (an active, approved publication of this quiz).
    const rows = await QuizModel.aggregate<StarterQuizCandidatePersistence>([
      { $match: match },
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
          _id: 1,
          slug: 1,
          title: 1,
          visibility: 1,
          questionCount: { $size: { $ifNull: ['$questions', []] } },
          isPremium: { $gt: [{ $size: '$premiumPublications' }, 0] },
          ...QUIZ_INDEX_BLOCK_PROJECTION,
        },
      },
    ]);
    return rows.map(({ _id, ...candidate }) => ({ quizId: _id.toString(), ...candidate }));
  }
}
