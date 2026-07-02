import type { DashboardInProgressQuizDto, DashboardStatsDto } from '@/dtos/dashboard';
import type {
  DashboardInProgressQuizRecord,
  DashboardUserProgressRecord,
} from '@/interfaces/repositories/IDashboardRepository';
import { serializeDate } from '@/lib/date-serialization';
import { calculateLevel, levelProgress, xpForNextLevel } from '@/lib/gamification';

function trimWeeklyActivity(
  activity: DashboardUserProgressRecord['weeklyActivity'],
  days: number = 14,
): DashboardUserProgressRecord['weeklyActivity'] {
  const entries = Object.entries(activity);
  if (entries.length <= days) return activity;
  return Object.fromEntries(
    entries.sort(([dayA], [dayB]) => dayB.localeCompare(dayA)).slice(0, days),
  );
}

export class DashboardDtoMapper {
  static toStats(
    progress: DashboardUserProgressRecord | null,
    dueCount: number,
  ): DashboardStatsDto {
    const xp = progress?.totalXp ?? 0;
    return {
      streak: progress?.currentStreak ?? 0,
      longestStreak: progress?.longestStreak ?? 0,
      streakFreezeCount: progress?.streakFreezeCount ?? 0,
      xp,
      level: calculateLevel(xp),
      xpToNextLevel: xpForNextLevel(xp),
      levelProgress: levelProgress(xp),
      dueCount,
      weeklyActivity: trimWeeklyActivity(progress?.weeklyActivity ?? {}),
      totalQuestionsLearned: progress?.totalQuestionsLearned ?? 0,
      totalReviewSessions: progress?.totalReviewSessions ?? 0,
      averageAccuracy: progress?.averageAccuracy ?? 0,
    };
  }

  static toInProgressQuiz(record: DashboardInProgressQuizRecord): DashboardInProgressQuizDto {
    return {
      quizId: record.quizId,
      title: record.title,
      slug: record.slug,
      answeredCount: record.answeredCount,
      totalQuestions: record.totalQuestions,
      updatedAt: serializeDate(record.updatedAt, 'quizProgress.updatedAt'),
    };
  }
}
