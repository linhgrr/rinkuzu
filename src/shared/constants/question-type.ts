export const QUESTION_TYPES = ['single', 'multiple'] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
