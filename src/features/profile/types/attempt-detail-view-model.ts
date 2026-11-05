import type { QuizQuestionReview } from '@/shared/types/quiz-question';

export type AttemptQuestionDetailViewModel = QuizQuestionReview;

export interface AttemptDetailViewModel {
  id: string;
  score: number;
  totalQuestions: number;
  takenAt: string;
  takenAtLabel: string;
  answers: (number | number[])[];
  historyStatus: 'complete' | 'quiz_modified' | 'content_locked';
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailViewModel[];
  };
  missedCount: number;
  nextQuiz: { slug: string; title: string } | null;
  retryOfAttemptId?: string;
  /** Retry or quick round: `quiz.questions[i]` is quiz question `questionIndices[i]`. */
  questionIndices?: number[];
  /** Quick round only (RIN-936): show "Quick round: X/10". */
  mode?: 'quick';
}
