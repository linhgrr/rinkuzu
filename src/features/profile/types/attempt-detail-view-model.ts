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
    id: string;
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailViewModel[];
    /** Public, non-Premium quiz: the result page offers "Send to a classmate" (RIN-1179). */
    shareable: boolean;
    /** Live quiz size; `totalQuestions` is this attempt's count. */
    questionCount: number;
  };
  missedCount: number;
  nextQuiz: { slug: string; title: string } | null;
  retryOfAttemptId?: string;
  /** Retry or quick round: `quiz.questions[i]` is quiz question `questionIndices[i]`. */
  questionIndices?: number[];
  /** Quick round only (RIN-936): show "Quick round: X/10". */
  mode?: 'quick';
}
