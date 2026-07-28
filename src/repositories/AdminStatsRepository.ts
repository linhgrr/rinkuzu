import type {
  AdminStatsDailyActivity,
  AdminStatsDailyAttemptRecord,
  AdminStatsDailyCountRecord,
  AdminStatsScoreBucket,
  IAdminStatsRepository,
} from '@/interfaces/repositories/IAdminStatsRepository';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import QuizModel from '@/models/Quiz';
import UserModel from '@/models/User';

interface DailyCountAggregate {
  _id: string;
  count: number;
}

interface DailyAttemptAggregate extends DailyCountAggregate {
  scoreTotal: number;
  scoredAttempts: number;
}

const SCORE_BUCKETS = [
  { min: 0, max: 10, range: '0–9%', passing: false },
  { min: 10, max: 20, range: '10–19%', passing: false },
  { min: 20, max: 30, range: '20–29%', passing: false },
  { min: 30, max: 40, range: '30–39%', passing: false },
  { min: 40, max: 50, range: '40–49%', passing: false },
  { min: 50, max: 60, range: '50–59%', passing: false },
  { min: 60, max: 70, range: '60–69%', passing: false },
  { min: 70, max: 80, range: '70–79%', passing: true },
  { min: 80, max: 90, range: '80–89%', passing: true },
  { min: 90, max: 101, range: '90–100%', passing: true },
] as const;
const SCORE_BOUNDARIES: number[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101];

const DAILY_GROUP_STAGE = {
  $group: {
    _id: {
      $dateToString: {
        format: '%Y-%m-%d',
        date: '$createdAt',
        timezone: 'UTC',
      },
    },
    count: { $sum: 1 },
  },
} as const;

export class AdminStatsRepository implements IAdminStatsRepository {
  async getDailyActivity(since: Date): Promise<AdminStatsDailyActivity> {
    await connectDB();

    const [users, quizzes, attempts] = await Promise.all([
      UserModel.aggregate<DailyCountAggregate>([
        { $match: { createdAt: { $gte: since } } },
        DAILY_GROUP_STAGE,
        { $sort: { _id: 1 } },
      ]),
      QuizModel.aggregate<DailyCountAggregate>([
        { $match: { createdAt: { $gte: since } } },
        DAILY_GROUP_STAGE,
        { $sort: { _id: 1 } },
      ]),
      AttemptModel.aggregate<DailyAttemptAggregate>([
        { $match: { takenAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$takenAt',
                timezone: 'UTC',
              },
            },
            count: { $sum: 1 },
            scoreTotal: { $sum: '$score' },
            scoredAttempts: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      users: users.map(AdminStatsRepository.toDailyCount),
      quizzes: quizzes.map(AdminStatsRepository.toDailyCount),
      attempts: attempts.map(AdminStatsRepository.toDailyAttempt),
    };
  }

  async getScoreDistribution(): Promise<AdminStatsScoreBucket[]> {
    await connectDB();
    const records = await AttemptModel.aggregate<{ _id: number; count: number }>([
      {
        $bucket: {
          groupBy: '$score',
          boundaries: SCORE_BOUNDARIES,
          default: 'outside',
          output: { count: { $sum: 1 } },
        },
      },
    ]);
    const counts = new Map(records.map((record) => [record._id, record.count]));

    return SCORE_BUCKETS.map((bucket) => ({
      ...bucket,
      count: counts.get(bucket.min) ?? 0,
    }));
  }

  private static toDailyCount(record: DailyCountAggregate): AdminStatsDailyCountRecord {
    return { date: record._id, count: record.count };
  }

  private static toDailyAttempt(record: DailyAttemptAggregate): AdminStatsDailyAttemptRecord {
    return {
      date: record._id,
      count: record.count,
      scoreTotal: record.scoreTotal,
      scoredAttempts: record.scoredAttempts,
    };
  }
}
