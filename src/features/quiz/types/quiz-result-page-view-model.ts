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

export interface QuizResultBookmarkMutationViewModel {
  id: string;
}
