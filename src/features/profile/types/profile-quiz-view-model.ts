import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { UserIdentity } from '@/components/user/user-identity';

export interface ProfileQuizViewModel {
  id: string;
  title: string;
  slug: string;
  author: string | UserIdentity | null;
  isPrivate: boolean;
  questionCount: number;
  ownedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
}

export interface ProfileQuizLibraryViewModel {
  quizzes: ProfileQuizViewModel[];
}

export interface ProfileQuizMonthGroupViewModel {
  key: string;
  label: string;
  quizzes: ProfileQuizViewModel[];
}
