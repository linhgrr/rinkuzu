import type { QuizQuestionReview } from '@/shared/types/quiz-question';

export type AttemptQuestionDetailViewModel = QuizQuestionReview;

export interface AttemptDetailViewModel {
  id: string;
  score: number;
  totalQuestions: number;
  takenAt: string;
  takenAtLabel: string;
  answers: (number | number[])[];
  historyStatus: 'complete' | 'quiz_modified';
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailViewModel[];
  };
}
