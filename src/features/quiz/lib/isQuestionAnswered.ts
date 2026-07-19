import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { QuestionType } from '@/shared/constants/question-type';

/**
 * Shared answered-state check for quiz player progress and result stats.
 * Preserves prior local semantics:
 * - single: any value other than -1 counts as answered (including undefined)
 * - multiple: only a non-empty array counts as answered
 */
export function isQuestionAnswered(
  question: { type: QuestionType },
  answer: QuizAnswer | undefined,
): boolean {
  if (question.type === 'single') {
    return answer !== -1;
  }

  return Array.isArray(answer) && answer.length > 0;
}
