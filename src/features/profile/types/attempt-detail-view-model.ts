import type { QuizQuestionReview } from '@/shared/types/quiz-question';

export type AttemptQuestionDetailViewModel = QuizQuestionReview;

/** A Premium preview attempt (RIN-1722): the result offers the unlock and a free quiz. */
interface AttemptPremiumPreviewViewModel {
  fullQuestionCount: number;
  quizId: string;
  freeQuiz: { slug: string; title: string } | null;
}

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
  nextQuiz: { slug: string; title: string; quick?: boolean } | null;
  premiumPreview?: AttemptPremiumPreviewViewModel;
  retryOfAttemptId?: string;
  /** Retry or quick round: `quiz.questions[i]` is quiz question `questionIndices[i]`. */
  questionIndices?: number[];
  /** Quick round only (RIN-936): show "Quick round: X/10". */
  mode?: 'quick';
}
