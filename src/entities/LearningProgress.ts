import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { SRSRating } from '@/entities/SpacedRepetition';

/** Library author identity — stable non-PII fields only (no email). */
export interface LibraryQuizAuthor {
  id: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface LibraryQuiz {
  id: string;
  title: string;
  slug: string;
  description?: string;
  author: LibraryQuizAuthor | null;
  folder: string | null;
  isPrivate: boolean;
  pdfUrl?: string;
  questionCount: number;
  ownedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastAttemptAt: Date | null;
  lastProgressAt: Date | null;
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
}

interface QuestionReference {
  text: string;
  options: string[];
  correctIndexes: number[];
}

interface ReviewHistoryEntry {
  date: Date;
  rating: SRSRating;
}

export interface QuestionReviewProgressDraft {
  userId: string;
  quizSlug: string;
  questionId: string;
  questionRef?: QuestionReference;
  srsLevel: number;
  nextReviewDate: Date;
  lastReviewDate: Date | null;
  interval: number;
  easeFactor: number;
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;
  history: ReviewHistoryEntry[];
  isBookmarked?: boolean;
  notes?: string;
}

export interface QuestionReviewProgress extends Omit<
  QuestionReviewProgressDraft,
  'isBookmarked' | 'notes'
> {
  id: string;
  isBookmarked: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyLearningActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export interface UserLearningProgress {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;
  totalXp: number;
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  lastSessionDate?: Date | null;
  averageAccuracy: number;
  weeklyActivity: Map<string, DailyLearningActivity>;
}

export interface SubmitReviewOutcome {
  questionProgress: QuestionReviewProgress;
  xpGained: number;
  streakFreezeUsed: boolean;
  userProgress: {
    xp: number;
    streak: number;
    xpGained: number;
    streakFreezeUsed: boolean;
  };
}

interface StreakFreezePurchase {
  xp: number;
  streakFreezeCount: number;
}

export interface StreakFreezePurchaseOptions {
  cost: number;
  maxFreezes: number;
}

export type StreakFreezePurchaseResult =
  | { status: 'not_found' }
  | { status: 'max_freezes' }
  | { status: 'not_enough_xp' }
  | ({ status: 'purchased' } & StreakFreezePurchase);
