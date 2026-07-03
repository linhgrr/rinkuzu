import type { DailyLearningActivity, QuestionReviewProgress } from '@/entities/LearningProgress';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';
import type { MongoIdLike } from '@/types/mongo';

export interface LibraryQuizAuthorPersistenceRecord {
  _id: MongoIdLike;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface LibraryQuizPersistenceRecord {
  _id: MongoIdLike;
  title: string;
  slug: string;
  description?: string;
  author: MongoIdLike | LibraryQuizAuthorPersistenceRecord | null;
  folder?: MongoIdLike | null;
  questions?: QuizQuestionPersistenceRecord[];
  questionCount?: number;
  isPrivate: boolean;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryQuizMappingContext {
  userId: string;
  linkedFolderId: string | null;
  lastAttemptAt: Date | null;
  lastProgressAt: Date | null;
}

export interface QuestionProgressPersistenceRecord {
  _id: MongoIdLike;
  userId: string;
  quizSlug: string;
  questionId: string;
  questionRef: QuestionReviewProgress['questionRef'];
  srsLevel: number;
  nextReviewDate: Date;
  lastReviewDate: Date | null;
  interval: number;
  easeFactor: number;
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;
  history: QuestionReviewProgress['history'];
  isBookmarked: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgressPersistenceRecord {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;
  totalXp: number;
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  lastSessionDate: Date | null;
  averageAccuracy: number;
  weeklyActivity: Map<string, DailyLearningActivity> | Record<string, DailyLearningActivity>;
}
