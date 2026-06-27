export type QuizLibraryStatus = 'not_started' | 'in_progress' | 'complete';
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
  folderParam: string | null,
): boolean {
  if (folderParam === null) return true;
  if (folderParam === 'null' || folderParam === 'default') return quizFolder === null;
  return quizFolder === folderParam;
}

export function matchesLibraryStatus(
  status: QuizLibraryStatus | undefined,
  filter: QuizLibraryFilter,
): boolean {
  return filter === 'all' || status === filter;
}
