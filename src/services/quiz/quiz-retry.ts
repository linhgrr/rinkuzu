import type { Attempt, AttemptAnswer } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';

function isCorrectAnswer(question: QuizQuestion, answer: AttemptAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (question.type === 'single') {
    return typeof answer === 'number' && answer >= 0 && answer === question.correctIndex;
  }
  if (!Array.isArray(answer) || answer.length !== question.correctIndexes.length) return false;
  const selected = new Set(answer);
  return question.correctIndexes.every((index) => selected.has(index));
}

/**
 * Indices (into `liveQuestions`, ascending) of the questions the learner got wrong or left
 * unanswered in `attempt`. Derived from the attempt's immutable snapshot and matched to the
 * live quiz by question id, so a client can never widen the set and a question deleted since
 * the attempt is dropped. Works for retry attempts too: their snapshot is already a subset.
 */
export function deriveMissedQuestionIndices(
  attempt: Attempt,
  liveQuestions: readonly QuizQuestion[],
): number[] {
  if (typeof attempt.quiz !== 'object' || !attempt.quiz.questions) {
    throw new TypeError('attempt.quiz.questions is required to derive missed questions');
  }
  const liveIndexById = new Map(liveQuestions.map((question, index) => [question.id, index]));
  const missed = new Set<number>();

  attempt.quiz.questions.forEach((question, position) => {
    if (isCorrectAnswer(question, attempt.answers[position])) return;
    const liveIndex = liveIndexById.get(question.id);
    if (liveIndex !== undefined) missed.add(liveIndex);
  });

  return [...missed].toSorted((left, right) => left - right);
}

/** Number of questions answered wrong or left blank in a stored attempt. */
export function countMissedAnswers(attempt: Attempt): number {
  if (typeof attempt.quiz !== 'object' || !attempt.quiz.questions) return 0;
  return attempt.quiz.questions.filter(
    (question, position) => !isCorrectAnswer(question, attempt.answers[position]),
  ).length;
}
