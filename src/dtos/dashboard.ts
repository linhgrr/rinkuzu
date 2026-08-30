import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import type { QuizListItemDto } from '@/dtos/quiz';

interface DashboardWeeklyActivityDto {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export interface DashboardStatsDto {
  streak: number;
  longestStreak: number;
  streakFreezeCount: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  weeklyActivity: Record<string, DashboardWeeklyActivityDto>;
  totalQuestionsLearned: number;
  totalReviewSessions: number;
  averageAccuracy: number;
}

export interface DashboardInProgressQuizDto {
  quizId: string;
  title: string;
  slug: string;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: string;
}

export interface DashboardBootstrapDto {
  stats: DashboardStatsDto;
  adaptiveSubjects: PipelineJobHistoryItem[];
  inProgressQuizzes: DashboardInProgressQuizDto[];
  recentOwnedQuizzes: QuizListItemDto[];
  recentPublicQuizzes: QuizListItemDto[];
}
