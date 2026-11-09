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

/** What the review prompt shows for one attempt (RIN-1362, `GET /api/user/review-reminder`). */
export interface ReviewReminderPromptStatus {
  optedIn: boolean;
  /** ISO time; set only while "No thanks" still hides the prompt. */
  snoozedUntil: string | null;
  eligible: boolean;
}

/** "Remind me" request for one attempt (RIN-1362). */
export interface ReviewReminderOptInInput {
  attemptId: string;
  locale: 'vi' | 'en';
}

/** Outcome of "Remind me": the email's send time, or the weekly cap already used. */
export type ReviewReminderOptInOutcome =
  | { status: 'scheduled'; scheduledFor: string }
  | { status: 'capped'; scheduledFor: null };

export interface QuizResultBookmarkMutationViewModel {
  id: string;
}

export interface CreateQuizResultBookmarkInput {
  result: QuizResultViewModel;
  questionIndex: number;
  question: QuizResultQuestionViewModel;
}
