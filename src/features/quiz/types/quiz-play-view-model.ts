import type { QuizQuestionDisplay } from '@/shared/types/quiz-question';

export interface QuizPlayAuthorViewModel {
  id: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export type QuizPlayQuestionViewModel = QuizQuestionDisplay;

export interface QuizPlayViewModel {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: QuizPlayAuthorViewModel | null;
  folder: string | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
  tags?: string[];
  questions: QuizPlayQuestionViewModel[];
}
