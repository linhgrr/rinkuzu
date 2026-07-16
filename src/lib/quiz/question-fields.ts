export interface QuizQuestionContentFields {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface QuizQuestionFields extends QuizQuestionContentFields {
  id: string;
}

export function copyQuizQuestionContentFields(
  question: QuizQuestionContentFields,
): QuizQuestionContentFields {
  return {
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };
}

export function copyQuizQuestionFields(question: QuizQuestionFields): QuizQuestionFields {
  return {
    id: question.id,
    ...copyQuizQuestionContentFields(question),
  };
}
