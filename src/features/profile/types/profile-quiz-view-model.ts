import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { QuizLibraryFilter } from '@/lib/quiz/library';
import type { UserIdentity } from '@/components/user/user-identity';
import type { ProfilePremiumSubmissionStatus } from '@/features/profile/api/premium-submissions-api';

export interface ProfileQuizViewModel {
  id: string;
  title: string;
  slug: string;
  author: UserIdentity | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  ownedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
  premiumSubmissionStatus?: ProfilePremiumSubmissionStatus;
  awardedCredits?: number;
}

/** Whole-library segment counts: they ignore the status filter, the search and the page. */
export interface ProfileQuizLibraryCounts {
  all: number;
  inProgress: number;
  complete: number;
}

export interface ProfileQuizLibraryViewModel {
  quizzes: ProfileQuizViewModel[];
  counts: ProfileQuizLibraryCounts;
  hasMore: boolean;
}

export interface ProfileQuizLibraryPageQuery {
  page: number;
  status: QuizLibraryFilter;
  q: string;
}

export interface ProfileQuizMonthGroupViewModel {
  key: string;
  label: string;
  quizzes: ProfileQuizViewModel[];
}
