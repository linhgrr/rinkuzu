import type { DashboardWeeklyActivityDto } from '@/dtos/dashboard';
import type { MongoIdLike } from '@/types/mongo';

export interface DashboardUserProgressPersistenceRecord {
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  totalXp: number;
  weeklyActivity:
    | Map<string, DashboardWeeklyActivityDto>
    | Record<string, DashboardWeeklyActivityDto>;
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
