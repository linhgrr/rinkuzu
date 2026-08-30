import type { MongoIdLike } from '@/types/mongo';

/**
 * One day's tally as the document stores it.
 *
 * The DTO carries the same four counters, and this deliberately does not reuse
 * it: a persistence record that imports from src/dtos makes the wire shape and
 * the stored shape one type, so a field added for the client silently becomes a
 * field the database is expected to hold.
 */
export interface DashboardWeeklyActivityFields {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export interface DashboardUserProgressPersistenceRecord {
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  totalXp: number;
  weeklyActivity:
    | Map<string, DashboardWeeklyActivityFields>
    | Record<string, DashboardWeeklyActivityFields>;
  totalQuestionsLearned: number;
  totalReviewSessions: number;
  averageAccuracy: number;
}

interface DashboardProgressQuizPersistenceRecord {
  _id: MongoIdLike;
  title: string;
  slug: string;
}

export interface DashboardProgressPersistenceRecord {
  quiz: DashboardProgressQuizPersistenceRecord | null;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}
