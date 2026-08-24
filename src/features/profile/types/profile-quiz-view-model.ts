import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
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

export interface ProfileQuizLibraryViewModel {
  quizzes: ProfileQuizViewModel[];
}

export interface ProfileQuizMonthGroupViewModel {
  key: string;
  label: string;
  quizzes: ProfileQuizViewModel[];
}
