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

export interface StarterQuizDto {
  slug: string;
  title: string;
  /** Questions the learner will see: the quick-round size (10) when `quick`. */
  questionCount: number;
  locale: string;
  /** Over 15 questions: the link opens a quick round (`?mode=quick`, RIN-1177). */
  quick: boolean;
}

export interface DashboardBootstrapDto {
  stats: DashboardStatsDto;
  adaptiveSubjects: PipelineJobHistoryItem[];
  inProgressQuizzes: DashboardInProgressQuizDto[];
  recentOwnedQuizzes: QuizListItemDto[];
  recentPublicQuizzes: QuizListItemDto[];
  isNewLearner: boolean;
  starterQuizzes: StarterQuizDto[];
}
