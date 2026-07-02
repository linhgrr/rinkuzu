import type { AttemptAnswer } from '@/entities/Attempt';

export function isAttemptAnswerAnswered(answer: AttemptAnswer): boolean {
  return Array.isArray(answer) ? answer.length > 0 : answer >= 0;
}

export function countAnsweredAttemptQuestions(answers: AttemptAnswer[]): number {
  return answers.filter(isAttemptAnswerAnswered).length;
}
