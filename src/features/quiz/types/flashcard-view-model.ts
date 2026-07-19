import type { QuizQuestionWithAnswerKey } from '@/shared/types/quiz-question';

export type FlashcardQuestionViewModel = QuizQuestionWithAnswerKey;

export interface FlashcardQuizViewModel {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions: FlashcardQuestionViewModel[];
}

export interface FlashcardReviewInput {
  quizSlug: string;
  question: FlashcardQuestionViewModel;
  rating: 'good' | 'hard';
}
