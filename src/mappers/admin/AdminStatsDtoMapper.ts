import type {
  AdminActivityStatsDto,
  AdminCreatorStatsListDto,
  AdminCreatorStatDto,
  AdminOverviewStatsDto,
  AdminRecentUserDto,
  AdminScoreStatsDto,
  AdminGrowthPeriodDto,
  AdminGrowthTrendsDto,
} from '@/dtos/admin-stats';
import type {
  AttemptScoreStats,
  RecentAttemptActivity,
} from '@/interfaces/repositories/IAttemptRepository';
import type { Quiz } from '@/entities/Quiz';
import type { User } from '@/entities/User';
import type { QuizCreatorStatRecord } from '@/interfaces/repositories/IQuizRepository';
import type { CountBuckets, PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import type {
  AdminStatsDailyActivity,
  AdminStatsDailyAttemptRecord,
  AdminStatsDailyCountRecord,
  AdminStatsScoreBucket,
} from '@/interfaces/repositories/IAdminStatsRepository';
import { serializeDate } from '@/lib/date-serialization';
import { AdminActivityDtoMapper } from '@/mappers/admin/AdminActivityDtoMapper';
import { AdminQuizDtoMapper } from '@/mappers/quiz/AdminQuizDtoMapper';

export class AdminStatsDtoMapper {
  static toOverviewDto(
    totalUsers: number,
    totalAdmins: number,
    totalQuizzes: number,
    totalAttempts: number,
  ): AdminOverviewStatsDto {
    return {
      totalUsers,
      totalAdmins,
      totalQuizzes,
      totalAttempts,
    };
  }

  static toActivityDto(
    userBuckets: CountBuckets,
    quizBuckets: CountBuckets,
    attemptBuckets: CountBuckets,
    recentUsers: User[],
    recentQuizzes: Quiz[],
    recentAttempts: RecentAttemptActivity[],
  ): AdminActivityStatsDto {
    return {
      timeBasedStats: {
        today: AdminStatsDtoMapper.toTimeBucketDto(
          userBuckets.today,
          quizBuckets.today,
          attemptBuckets.today,
        ),
        thisWeek: AdminStatsDtoMapper.toTimeBucketDto(
          userBuckets.thisWeek,
          quizBuckets.thisWeek,
          attemptBuckets.thisWeek,
        ),
        thisMonth: AdminStatsDtoMapper.toTimeBucketDto(
          userBuckets.thisMonth,
          quizBuckets.thisMonth,
          attemptBuckets.thisMonth,
        ),
      },
      recentActivity: {
        users: recentUsers.map(AdminStatsDtoMapper.toRecentUserDto),
        quizzes: recentQuizzes.map(AdminQuizDtoMapper.toListItem),
        attempts: recentAttempts.map(AdminActivityDtoMapper.toRecentAttempt),
      },
    };
  }

  static toScoreStatsDto(
    stats: AttemptScoreStats,
    distribution: AdminStatsScoreBucket[],
  ): AdminScoreStatsDto {
    const totalAttempts = distribution.reduce((sum, bucket) => sum + bucket.count, 0);
    const passingAttempts = distribution.reduce(
      (sum, bucket) => sum + (bucket.passing ? bucket.count : 0),
      0,
    );

    return {
      averageScore: Math.round(stats.averageScore),
      highestScore: stats.highestScore,
      lowestScore: stats.lowestScore,
      passRate: totalAttempts === 0 ? 0 : Math.round((passingAttempts / totalAttempts) * 100),
      scoreDistribution: distribution.map((bucket) => ({ ...bucket })),
    };
  }

  static toGrowthTrendsDto(
    activity: AdminStatsDailyActivity,
    period: AdminGrowthPeriodDto,
    now: Date,
  ): AdminGrowthTrendsDto {
    const today = AdminStatsDtoMapper.startOfUtcDay(now);
    const allDates = Array.from({ length: period * 2 }, (_, index) =>
      AdminStatsDtoMapper.toDateKey(
        new Date(today.getTime() - (period * 2 - index - 1) * 86_400_000),
      ),
    );
    const users = AdminStatsDtoMapper.toCountMap(activity.users);
    const quizzes = AdminStatsDtoMapper.toCountMap(activity.quizzes);
    const attempts = new Map(activity.attempts.map((record) => [record.date, record]));
    const allData = allDates.map((date) => {
      const attempt = attempts.get(date);
      return {
        date,
        newUsers: users.get(date) ?? 0,
        newQuizzes: quizzes.get(date) ?? 0,
        attempts: attempt?.count ?? 0,
        averageScore:
          attempt && attempt.scoredAttempts > 0
            ? Math.round((attempt.scoreTotal / attempt.scoredAttempts) * 10) / 10
            : null,
      };
    });
    const previous = allData.slice(0, period);
    const current = allData.slice(period);
    const currentAverage = AdminStatsDtoMapper.weightedAverageScore(
      activity.attempts,
      new Set(current.map((point) => point.date)),
    );
    const previousAverage = AdminStatsDtoMapper.weightedAverageScore(
      activity.attempts,
      new Set(previous.map((point) => point.date)),
    );

    return {
      period,
      from: current[0]?.date ?? AdminStatsDtoMapper.toDateKey(today),
      to: current.at(-1)?.date ?? AdminStatsDtoMapper.toDateKey(today),
      data: current,
      comparison: {
        newUsers: AdminStatsDtoMapper.toComparison(
          current.reduce((sum, point) => sum + point.newUsers, 0),
          previous.reduce((sum, point) => sum + point.newUsers, 0),
        ),
        newQuizzes: AdminStatsDtoMapper.toComparison(
          current.reduce((sum, point) => sum + point.newQuizzes, 0),
          previous.reduce((sum, point) => sum + point.newQuizzes, 0),
        ),
        attempts: AdminStatsDtoMapper.toComparison(
          current.reduce((sum, point) => sum + point.attempts, 0),
          previous.reduce((sum, point) => sum + point.attempts, 0),
        ),
        averageScore: AdminStatsDtoMapper.toComparison(currentAverage, previousAverage),
      },
    };
  }

  static toCreatorDto(creator: QuizCreatorStatRecord): AdminCreatorStatDto {
    return {
      id: creator.id,
      email: creator.email,
      quizCount: creator.quizCount,
      totalQuestions: creator.totalQuestions,
      joinedAt: serializeDate(creator.joinedAt, 'creator.joinedAt'),
      role: creator.role,
    };
  }

  static toCreatorListDto(
    creators: PaginatedRepositoryResult<QuizCreatorStatRecord>,
  ): AdminCreatorStatsListDto {
    return {
      creators: creators.items.map(AdminStatsDtoMapper.toCreatorDto),
      pagination: creators.pagination,
    };
  }

  private static toTimeBucketDto(
    newUsers: number,
    newQuizzes: number,
    attempts: number,
  ): AdminActivityStatsDto['timeBasedStats']['today'] {
    return { newUsers, newQuizzes, attempts };
  }

  private static toRecentUserDto(user: User): AdminRecentUserDto {
    return {
      email: user.email,
      createdAt: serializeDate(user.createdAt, 'recentUser.createdAt'),
    };
  }

  private static startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private static toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private static toCountMap(records: AdminStatsDailyCountRecord[]): Map<string, number> {
    return new Map(records.map((record) => [record.date, record.count]));
  }

  private static weightedAverageScore(
    records: AdminStatsDailyAttemptRecord[],
    dates: Set<string>,
  ): number {
    const totals = records.reduce(
      (result, record) =>
        dates.has(record.date)
          ? {
              score: result.score + record.scoreTotal,
              count: result.count + record.scoredAttempts,
            }
          : result,
      { score: 0, count: 0 },
    );
    return totals.count === 0 ? 0 : Math.round((totals.score / totals.count) * 10) / 10;
  }

  private static toComparison(current: number, previous: number) {
    return {
      current,
      previous,
      changePercent:
        previous === 0
          ? current === 0
            ? 0
            : null
          : Math.round(((current - previous) / previous) * 1000) / 10,
    };
  }
}
