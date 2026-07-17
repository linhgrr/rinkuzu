/**
 * Shared quiz question content fields.
 * Input-side optionals accept `undefined` under exactOptionalPropertyTypes so DTO
 * sources can be passed through; helpers strip undefined on copy (output omits the key).
 */
export interface QuizQuestionContentFields {
  question: string;
  options: string[];
  questionImage?: string | undefined;
  optionImages?: (string | undefined)[] | undefined;
}

export interface QuizQuestionFields extends QuizQuestionContentFields {
  id: string;
}

/** Strict content shape: optional keys are present only when defined. */
export type QuizQuestionContentFieldsOutput = {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
};

export type QuizQuestionFieldsOutput = QuizQuestionContentFieldsOutput & {
  id: string;
};

export function copyQuizQuestionContentFields(
  question: QuizQuestionContentFields,
): QuizQuestionContentFieldsOutput {
  return {
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };
}

export function copyQuizQuestionFields(question: QuizQuestionFields): QuizQuestionFieldsOutput {
  return {
    id: question.id,
    ...copyQuizQuestionContentFields(question),
  };
}
