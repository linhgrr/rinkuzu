import type { AdminStatsDto } from '@/dtos/admin-stats';
import type {
  AdminGrowthTrendsViewModel,
  AdminRecentAttemptViewModel,
  AdminStatsViewModel,
} from '@/features/admin/stats/types/admin-stats-view-model';
import { formatDateTime } from '@/lib/formatters';

function toRecentAttemptViewModel(
  attempt: AdminStatsDto['recentActivity']['attempts'][number],
): AdminRecentAttemptViewModel {
  return {
    id: attempt.id,
    score: attempt.score,
    takenAt: attempt.takenAt,
    takenAtLabel: formatDateTime(attempt.takenAt),
    answeredQuestions: attempt.answeredQuestions,
    actor: {
      ...(attempt.actor.email === undefined ? {} : { email: attempt.actor.email }),
      type: attempt.actor.type,
    },
    quiz: {
      title: attempt.quiz.title,
    },
  };
}

export function toAdminGrowthTrendsViewModel(
  dto: AdminStatsDto['growthTrends'],
): AdminGrowthTrendsViewModel {
  return {
    period: dto.period,
    from: dto.from,
    to: dto.to,
    data: dto.data.map((point) => ({ ...point })),
    comparison: {
      newUsers: { ...dto.comparison.newUsers },
      newQuizzes: { ...dto.comparison.newQuizzes },
      attempts: { ...dto.comparison.attempts },
      averageScore: { ...dto.comparison.averageScore },
    },
  };
}

export function toAdminStatsViewModel(dto: AdminStatsDto): AdminStatsViewModel {
  return {
    overview: {
      totalQuizzes: dto.overview.totalQuizzes,
      totalUsers: dto.overview.totalUsers,
      totalAdmins: dto.overview.totalAdmins,
      totalAttempts: dto.overview.totalAttempts,
    },
    timeBasedStats: {
      today: { ...dto.timeBasedStats.today },
      thisWeek: { ...dto.timeBasedStats.thisWeek },
      thisMonth: { ...dto.timeBasedStats.thisMonth },
    },
    recentActivity: {
      users: dto.recentActivity.users.map((user) => ({
        email: user.email,
        createdAt: user.createdAt,
        createdAtLabel: formatDateTime(user.createdAt),
      })),
      quizzes: dto.recentActivity.quizzes.map((quiz) => ({
        title: quiz.title,
        createdAt: quiz.createdAt,
        createdAtLabel: formatDateTime(quiz.createdAt),
        questionCount: quiz.questionCount,
      })),
      attempts: dto.recentActivity.attempts.map(toRecentAttemptViewModel),
    },
    topCreators: dto.topCreators.map((creator) => ({
      id: creator.id,
      email: creator.email,
      quizCount: creator.quizCount,
      totalQuestions: creator.totalQuestions,
      joinedAt: creator.joinedAt,
      role: creator.role,
    })),
    scoreStats: {
      averageScore: dto.scoreStats.averageScore,
      highestScore: dto.scoreStats.highestScore,
      lowestScore: dto.scoreStats.lowestScore,
      passRate: dto.scoreStats.passRate,
      scoreDistribution: dto.scoreStats.scoreDistribution.map((bucket) => ({ ...bucket })),
    },
    growthTrends: toAdminGrowthTrendsViewModel(dto.growthTrends),
  };
}
