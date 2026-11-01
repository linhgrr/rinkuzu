import type {
  AdminActivationAggregates,
  AdminActivationCohortRecord,
  AdminFirstAttemptWeekRecord,
  AdminStatsDailyActivity,
  AdminStatsDailyAttemptRecord,
  AdminStatsDailyCountRecord,
  AdminStatsScoreBucket,
  IAdminStatsRepository,
} from '@/interfaces/repositories/IAdminStatsRepository';
import type { PipelineStage, Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import QuizModel from '@/models/Quiz';
import UserModel from '@/models/User';
import {
  ANALYTICS_EXCLUDED_EMAILS,
  ANALYTICS_TEST_EMAIL_PATTERN,
} from '@/shared/constants/analytics-exclusions';
import { ACCOUNT_DISABLE_DISABLED } from '@/shared/constants/account-disable';

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

const DAY_MS = 86_400_000;

/** Who counts as a learner: not an admin, not disabled, not a test/QA account. */
const LEARNER_FILTER = {
  role: { $ne: 'admin' },
  disable: { $ne: ACCOUNT_DISABLE_DISABLED },
  email: { $nin: [...ANALYTICS_EXCLUDED_EMAILS], $not: ANALYTICS_TEST_EMAIL_PATTERN },
} as const;

function utcWeekStart(date: string) {
  return { $dateTrunc: { date, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } };
}

/** True when any date in `dates` lies in `[from, to)`. */
function anyDateIn(dates: string, from: unknown, to: unknown) {
  return {
    $anyElementTrue: [
      {
        $map: {
          input: dates,
          as: 'd',
          in: { $and: [{ $gte: ['$$d', from] }, { $lt: ['$$d', to] }] },
        },
      },
    ],
  };
}

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

  async getActivationAggregates(from: Date, to: Date): Promise<AdminActivationAggregates> {
    await connectDB();
    const [cohorts, firstAttempts] = await Promise.all([
      UserModel.aggregate<AdminActivationCohortRecord & { _id: Date }>(
        AdminStatsRepository.cohortPipeline(from, to),
      ).allowDiskUse(true),
      AdminStatsRepository.excludedUserIds().then((excluded) =>
        AttemptModel.aggregate<AdminFirstAttemptWeekRecord & { _id: Date }>(
          AdminStatsRepository.firstAttemptPipeline(from, to, excluded),
        ),
      ),
    ]);
    return {
      cohorts: cohorts.map(({ _id, ...counts }) => ({ ...counts, weekStart: _id })),
      firstAttempts: firstAttempts.map(({ _id, learners }) => ({ weekStart: _id, learners })),
    };
  }

  /**
   * Ids of every account that is not a learner. A small set (admins, disabled
   * and test accounts), so the attempt pipeline filters on it with `$nin`
   * instead of looking up each attempting user.
   */
  private static async excludedUserIds(): Promise<Types.ObjectId[]> {
    const rows = await UserModel.find(
      {
        $or: [
          { role: 'admin' },
          { disable: ACCOUNT_DISABLE_DISABLED },
          { email: { $in: [...ANALYTICS_EXCLUDED_EMAILS] } },
          { email: ANALYTICS_TEST_EMAIL_PATTERN },
        ],
      },
      { _id: 1 },
    )
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();
    return rows.map((row) => row._id);
  }

  /**
   * One row per signup week, without a per-signup lookup: the window's
   * signups (`User {createdAt:-1}`), attempts (`Attempt {takenAt:-1}`) and
   * quizzes (`Quiz {createdAt:-1}`) are unioned and grouped by user, so the
   * cost is three index range scans plus one in-memory group. Attempts and
   * quizzes from accounts that did not sign up in the window fall out at the
   * `signupAt` match.
   *
   * `material` is "authored a quiz, or attempted a quiz they did not author,
   * within 7 days". An attempt on one's own quiz within 7 days implies that
   * quiz was authored within those 7 days, so this is the same set as
   * "authored a quiz or has any attempt within 7 days", which needs no quiz
   * author per attempt.
   */
  static cohortPipeline(from: Date, to: Date): PipelineStage[] {
    const signupAt = '$signupAt';
    const day7 = { $add: [signupAt, 7 * DAY_MS] };
    const day14 = { $add: [signupAt, 14 * DAY_MS] };
    return [
      { $match: { createdAt: { $gte: from, $lt: to }, ...LEARNER_FILTER } },
      { $project: { _id: 0, uid: '$_id', signupAt: '$createdAt' } },
      {
        $unionWith: {
          coll: AttemptModel.collection.name,
          pipeline: [
            {
              $match: {
                takenAt: { $gte: from, $lt: new Date(to.getTime() + 14 * DAY_MS) },
                user: { $type: 'objectId' },
              },
            },
            { $project: { _id: 0, uid: '$user', takenAt: 1 } },
          ],
        },
      },
      {
        $unionWith: {
          coll: QuizModel.collection.name,
          pipeline: [
            { $match: { createdAt: { $gte: from, $lt: new Date(to.getTime() + 7 * DAY_MS) } } },
            { $project: { _id: 0, uid: '$author', quizAt: '$createdAt' } },
          ],
        },
      },
      {
        $group: {
          _id: '$uid',
          signupAt: { $max: '$signupAt' },
          takenAts: { $push: '$takenAt' },
          quizAts: { $push: '$quizAt' },
        },
      },
      { $match: { signupAt: { $type: 'date' } } },
      {
        $project: {
          weekStart: utcWeekStart(signupAt),
          activated: anyDateIn('$takenAts', signupAt, day7),
          authored: anyDateIn('$quizAts', signupAt, day7),
          returned: anyDateIn('$takenAts', day7, day14),
        },
      },
      {
        $group: {
          _id: '$weekStart',
          signups: { $sum: 1 },
          material: { $sum: { $cond: [{ $or: ['$authored', '$activated'] }, 1, 0] } },
          activated: { $sum: { $cond: ['$activated', 1, 0] } },
          w1Retained: { $sum: { $cond: [{ $and: ['$activated', '$returned'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];
  }

  /**
   * One row per week of first-ever attempts. The `$sort` + `$group`/`$first`
   * pair runs as a DISTINCT_SCAN over `Attempt {user:1,takenAt:-1}` (walked in
   * reverse): one index seek per distinct user ever, no documents read, so it
   * grows with learners rather than attempts. Excluded accounts and first
   * attempts outside the window are dropped after the scan; filtering before
   * it would disable the DISTINCT_SCAN.
   */
  static firstAttemptPipeline(
    from: Date,
    to: Date,
    excludedUserIds: readonly Types.ObjectId[],
  ): PipelineStage[] {
    return [
      { $match: { user: { $type: 'objectId' } } },
      { $sort: { user: -1, takenAt: 1 } },
      { $group: { _id: '$user', firstTakenAt: { $first: '$takenAt' } } },
      {
        $match: {
          _id: { $nin: [...excludedUserIds] },
          firstTakenAt: { $gte: from, $lt: to },
        },
      },
      { $group: { _id: utcWeekStart('$firstTakenAt'), learners: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
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
