import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import { serializeDate } from '@/lib/date-serialization';
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
    return {
      libraryStatus: 'in_progress',
      displayDate: serializeDate(lastProgressAt, 'quiz.lastProgressAt'),
    };
  }
  if (lastAttemptAt) {
    return {
      libraryStatus: 'complete',
      displayDate: serializeDate(lastAttemptAt, 'quiz.lastAttemptAt'),
    };
  }
  return { libraryStatus: 'not_started', displayDate: serializeDate(createdAt, 'quiz.createdAt') };
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
