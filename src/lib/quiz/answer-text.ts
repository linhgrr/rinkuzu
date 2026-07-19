import type { QuestionType } from '@/shared/constants/question-type';

export interface CorrectAnswerSource {
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
}

export function getCorrectAnswerIndexes(question: CorrectAnswerSource): number[] {
  if (question.type === 'single') {
    return typeof question.correctIndex === 'number' ? [question.correctIndex] : [];
  }

  return question.correctIndexes ?? [];
}

export function getCorrectAnswerOptions(question: CorrectAnswerSource): string[] {
  return getCorrectAnswerIndexes(question).flatMap((index) => {
    const option = question.options[index];
    return option === undefined ? [] : [option];
  });
}

export function formatCorrectAnswerText(question: CorrectAnswerSource, emptyLabel = ''): string {
  const answers = getCorrectAnswerOptions(question);
  return answers.length > 0 ? answers.join(', ') : emptyLabel;
}

export function formatCorrectAnswerLetters(
  question: Pick<CorrectAnswerSource, 'type' | 'correctIndex' | 'correctIndexes'>,
  emptyLabel = '',
): string {
  const indexes =
    question.type === 'single'
      ? typeof question.correctIndex === 'number'
        ? [question.correctIndex]
        : []
      : (question.correctIndexes ?? []);

  return indexes.length > 0
    ? indexes.map((index) => String.fromCharCode(65 + index)).join(', ')
    : emptyLabel;
}
