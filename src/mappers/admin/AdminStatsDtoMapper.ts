import type {
  AdminActivityStatsDto,
  AdminCreatorStatDto,
  AdminOverviewStatsDto,
  AdminRecentUserDto,
} from '@/dtos/admin-stats';
import type { Attempt } from '@/entities/Attempt';
import type { Quiz } from '@/entities/Quiz';
import type { User } from '@/entities/User';
import type { QuizCreatorStatRecord } from '@/interfaces/repositories/IQuizRepository';
import type { CountBuckets } from '@/interfaces/repositories/types';
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
    recentAttempts: Attempt[],
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
}
