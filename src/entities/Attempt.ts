import type { QuizQuestion } from '@/entities/Quiz';

export type AttemptAnswer = number | number[];

export interface AttemptUserPreview {
  id: string;
  email: string;
}

export interface AttemptQuizSnapshot {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions?: QuizQuestion[];
}

export interface Attempt {
  id: string;
  user: string | AttemptUserPreview | null;
  guestEmail?: string;
  quiz: string | AttemptQuizSnapshot;
  answers: AttemptAnswer[];
  score: number;
  totalQuestions: number;
  takenAt: Date;
}
