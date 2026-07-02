import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
export type QuizLibraryFilter = 'all' | 'in_progress' | 'complete';

export function resolveQuizLibraryActivity(
  createdAt: Date,
  lastAttemptAt?: Date,
  lastProgressAt?: Date,
): {
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
} {
  if (lastProgressAt) {
    return { libraryStatus: 'in_progress', displayDate: lastProgressAt.toISOString() };
  }
  if (lastAttemptAt) {
    return { libraryStatus: 'complete', displayDate: lastAttemptAt.toISOString() };
  }
  return { libraryStatus: 'not_started', displayDate: createdAt.toISOString() };
}

export function matchesLibraryFolder(
  quizFolder: string | null,
  folderFilter: string | null | undefined,
): boolean {
  if (folderFilter === undefined) return true;
  return quizFolder === folderFilter;
}

export function matchesLibraryStatus(
  status: QuizLibraryStatus | undefined,
  filter: QuizLibraryFilter,
): boolean {
  return filter === 'all' || status === filter;
}
