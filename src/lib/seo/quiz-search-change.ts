import type {
  IQuizIndexNowNotifier,
  QuizIndexNowChange,
} from '@/interfaces/services/IIndexNowNotifier';
import { logger } from '@/lib/logger';
import { isPersonalDataFlagged } from '@/lib/quiz/personal-data';
import { isQuizIndexable } from '@/lib/seo/quiz-indexability';

/**
 * The fields of a stored quiz that decide whether its page may be indexed and
 * what a search engine sees on it (RIN-1500). The owner is left out: no quiz
 * mutation changes who owns the quiz, so the IndexNow notifier checks the owner
 * once, after the response.
 */
export interface QuizSearchFacts {
  visibility: string;
  title: string;
  questions: readonly unknown[];
  questionCount?: number | undefined;
  contentFlags?: Parameters<typeof isPersonalDataFlagged>[0];
  indexHold?: unknown;
}

function isIndexableApartFromOwner(quiz: QuizSearchFacts): boolean {
  return isQuizIndexable({
    visibility: quiz.visibility,
    ownerIndexable: true,
    questionCount: quiz.questionCount ?? quiz.questions.length,
    personalDataFlagged: isPersonalDataFlagged(quiz.contentFlags),
    indexHold: quiz.indexHold !== undefined,
  });
}

/**
 * True when a quiz page should be re-crawled after a change from `before` to
 * `after`: it became or stopped being indexable, or it stayed indexable and its
 * title or questions (what the page and its `lastmod` show) changed. A save
 * that changes none of that is false, so it never pings.
 */
function quizSearchChanged(before: QuizSearchFacts, after: QuizSearchFacts): boolean {
  const wasIndexable = isIndexableApartFromOwner(before);
  const isIndexable = isIndexableApartFromOwner(after);
  if (wasIndexable !== isIndexable) return true;
  if (!isIndexable) return false;
  return (
    before.title !== after.title ||
    JSON.stringify(before.questions) !== JSON.stringify(after.questions)
  );
}

/**
 * Hands the change to the IndexNow notifier, if one is wired. Never throws: a
 * failure is logged and the user's action goes on (RIN-1496 AC 2).
 */
export function notifyQuizIndexNow(
  notifier: IQuizIndexNowNotifier | undefined,
  change: QuizIndexNowChange,
): void {
  if (!notifier) return;
  try {
    notifier.quizChanged(change);
  } catch (error) {
    logger.warn({ error, quizId: change.quizId }, 'IndexNow notify for a quiz change failed');
  }
}

/** Notifies IndexNow when `quizSearchChanged(before, after)`. */
export function notifyQuizSearchChange(
  notifier: IQuizIndexNowNotifier | undefined,
  before: QuizSearchFacts,
  after: QuizSearchFacts & { id: string; slug: string },
): void {
  if (!notifier || !quizSearchChanged(before, after)) return;
  notifyQuizIndexNow(notifier, { quizId: after.id, slug: after.slug, cause: 'indexability' });
}
