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
  static toStats(progress: DashboardUserProgressRecord, dueCount: number): DashboardStatsDto {
    const xp = progress.totalXp;
    return {
      streak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      streakFreezeCount: progress.streakFreezeCount,
      xp,
      level: calculateLevel(xp),
      xpToNextLevel: xpForNextLevel(xp),
      levelProgress: levelProgress(xp),
      dueCount,
      weeklyActivity: trimWeeklyActivity(progress.weeklyActivity),
      totalQuestionsLearned: progress.totalQuestionsLearned,
      totalReviewSessions: progress.totalReviewSessions,
      averageAccuracy: progress.averageAccuracy,
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
