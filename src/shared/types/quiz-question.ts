import type { QuestionType } from '@/shared/constants/question-type';

export interface QuizQuestionDisplay {
  id: string;
  question: string;
  options: string[];
  type: QuestionType;
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface QuizQuestionWithAnswerKey extends QuizQuestionDisplay {
  correctIndex?: number;
  correctIndexes?: number[];
}

export interface QuizQuestionReview extends QuizQuestionWithAnswerKey {
  userAnswer: number | number[];
  isCorrect: boolean;
}
