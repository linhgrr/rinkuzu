import type { DashboardWeeklyActivityDto } from '@/dtos/dashboard';

export interface DashboardUserProgressRecord {
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  totalXp: number;
  weeklyActivity: Record<string, DashboardWeeklyActivityDto>;
  totalQuestionsLearned: number;
  totalReviewSessions: number;
  averageAccuracy: number;
}

export interface DashboardInProgressQuizRecord {
  quizId: string;
  title: string;
  slug: string;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}

export interface IDashboardRepository {
  findUserProgress(userId: string): Promise<DashboardUserProgressRecord | null>;
  countDueQuestions(userId: string, now: Date): Promise<number>;
  findInProgressQuizzes(userId: string, limit: number): Promise<DashboardInProgressQuizRecord[]>;
}
