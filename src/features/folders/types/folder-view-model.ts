import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { UserIdentity } from '@/components/user/user-identity';

export interface FolderSummaryViewModel {
  id: string;
  name: string;
  quizCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderListViewModel {
  folders: FolderSummaryViewModel[];
  unfiledCount: number;
}

export interface FolderLibraryQuizViewModel {
  id: string;
  title: string;
  slug: string;
  description?: string;
  author: UserIdentity | null;
  folder: string | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  ownedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  lastProgressAt: string | null;
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
}
