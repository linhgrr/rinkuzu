import type { DashboardWeeklyActivityFields } from '@/repositories/types/DashboardPersistence';

export interface DashboardUserProgressRecord {
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  totalXp: number;
  weeklyActivity: Record<string, DashboardWeeklyActivityFields>;
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

export interface DashboardStarterQuizCandidateRecord {
  slug: string;
  title: string;
  visibility: string;
  questionCount: number;
  isPremium: boolean;
}

export interface IDashboardRepository {
  findUserProgress(userId: string): Promise<DashboardUserProgressRecord | null>;
  countDueQuestions(userId: string, now: Date): Promise<number>;
  findInProgressQuizzes(userId: string, limit: number): Promise<DashboardInProgressQuizRecord[]>;
  hasSubmittedAttempt(userId: string): Promise<boolean>;
  hasAuthoredQuiz(userId: string): Promise<boolean>;
  findStarterQuizCandidates(slugs: string[]): Promise<DashboardStarterQuizCandidateRecord[]>;
}
