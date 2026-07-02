import type {
  DashboardInProgressQuizRecord,
  DashboardUserProgressRecord,
} from '@/interfaces/repositories/IDashboardRepository';
import { serializeId } from '@/lib/mongo-id';
import type {
  DashboardProgressPersistenceRecord,
  DashboardUserProgressPersistenceRecord,
} from '@/repositories/types/DashboardPersistence';

function toWeeklyActivityRecord(
  activity: DashboardUserProgressPersistenceRecord['weeklyActivity'],
): DashboardUserProgressRecord['weeklyActivity'] {
  if (activity instanceof Map) {
    return Object.fromEntries(activity);
  }
  return activity;
}

export class DashboardPersistenceMapper {
  static toUserProgress(
    record: DashboardUserProgressPersistenceRecord,
  ): DashboardUserProgressRecord {
    return {
      currentStreak: record.currentStreak,
      longestStreak: record.longestStreak,
      streakFreezeCount: record.streakFreezeCount,
      totalXp: record.totalXp,
      weeklyActivity: toWeeklyActivityRecord(record.weeklyActivity),
      totalQuestionsLearned: record.totalQuestionsLearned,
      totalReviewSessions: record.totalReviewSessions,
      averageAccuracy: record.averageAccuracy,
    };
  }

  static toInProgressQuiz(
    record: DashboardProgressPersistenceRecord,
  ): DashboardInProgressQuizRecord | null {
    if (!record.quiz) return null;

    return {
      quizId: serializeId(record.quiz._id, 'quiz._id'),
      title: record.quiz.title,
      slug: record.quiz.slug,
      answeredCount: record.answeredCount,
      totalQuestions: record.totalQuestions,
      updatedAt: record.updatedAt,
    };
  }
}
