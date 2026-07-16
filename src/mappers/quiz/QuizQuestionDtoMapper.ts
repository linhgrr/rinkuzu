import type { QuizQuestionDto } from '@/dtos/quiz';
import type { QuizQuestion } from '@/entities/Quiz';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

export function toQuizQuestionDto(question: QuizQuestion): QuizQuestionDto {
  const base = copyQuizQuestionFields(question);

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}
