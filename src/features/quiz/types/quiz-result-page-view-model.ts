import type {
  AttemptDetailViewModel,
  AttemptQuestionDetailViewModel,
} from '@/features/profile/types/attempt-detail-view-model';

export type QuizResultViewModel = AttemptDetailViewModel;

export type QuizResultQuestionViewModel = AttemptQuestionDetailViewModel;

export interface QuizResultBookmarkLookup {
  bookmarkedQuestions: Set<number>;
  bookmarkIdsByQuestion: Record<number, string>;
}

export interface QuizResultPageDataViewModel {
  result: QuizResultViewModel;
  bookmarks: QuizResultBookmarkLookup;
}

/** Result-page review-email tick or untick (RIN-917). */
export interface SaveReviewReminderInput {
  attemptId: string;
  optIn: boolean;
  locale: 'vi' | 'en';
}

export interface QuizResultBookmarkMutationViewModel {
  id: string;
}

export interface CreateQuizResultBookmarkInput {
  result: QuizResultViewModel;
  questionIndex: number;
  question: QuizResultQuestionViewModel;
}
