import { getCorrectAnswerIndexes } from '@/lib/quiz/answer-text';
import type {
  QuizEditorQuestionInputViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';

export type EditableQuestionField = 'question' | 'options' | 'questionImage' | 'optionImages';

export function createEmptyEditorQuestion(editorId: string): QuizEditorQuestionViewModel {
  return {
    editorId,
    question: '',
    options: ['', '', '', ''],
    // Pre-size option image slots so the editor can upload per-answer images immediately.
    optionImages: [undefined, undefined, undefined, undefined],
    type: 'single',
    correctIndex: 0,
  };
}

export function toEditorQuestions(
  questions: QuizQuestionInputViewModel[],
  idPrefix = 'question',
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    const base = {
      editorId: `${idPrefix}-${index}`,
      question: question.question,
      options: question.options,
      ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
      ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
    };

    return question.type === 'single'
      ? { ...base, type: 'single' as const, correctIndex: question.correctIndex }
      : { ...base, type: 'multiple' as const, correctIndexes: question.correctIndexes };
  });
}

export function toQuestionInputs(
  questions: QuizEditorQuestionViewModel[],
): QuizEditorQuestionInputViewModel[] {
  return questions.map((question) => {
    const base = {
      question: question.question,
      options: question.options,
      ...(question.questionImage ? { questionImage: question.questionImage } : {}),
      ...(question.optionImages?.some(Boolean) ? { optionImages: question.optionImages } : {}),
    };

    return question.type === 'single'
      ? { ...base, type: 'single', correctIndex: question.correctIndex }
      : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
  });
}

function withBase(question: QuizEditorQuestionViewModel) {
  return {
    ...(question.id !== undefined && { id: question.id }),
    editorId: question.editorId,
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };
}

export function updateQuestionField(
  questions: QuizEditorQuestionViewModel[],
  index: number,
  field: EditableQuestionField,
  value: QuizEditorQuestionViewModel[EditableQuestionField],
): QuizEditorQuestionViewModel[] {
  return questions.map((question, questionIndex) =>
    questionIndex === index ? { ...question, [field]: value } : question,
  );
}

export function updateOption(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  optionIndex: number,
  value: string,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    const options = [...question.options];
    options[optionIndex] = value;
    return { ...question, options };
  });
}

export function updateQuestionImage(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  value?: string,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    if (value !== undefined) return { ...question, questionImage: value };

    const updatedQuestion = { ...question };
    delete updatedQuestion.questionImage;
    return updatedQuestion;
  });
}

export function updateOptionImage(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  optionIndex: number,
  value?: string,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    const optionImages = question.optionImages
      ? [...question.optionImages]
      : new Array(question.options.length).fill(undefined);
    optionImages[optionIndex] = value;
    return { ...question, optionImages };
  });
}

export function removeQuestionAt(
  questions: QuizEditorQuestionViewModel[],
  index: number,
): QuizEditorQuestionViewModel[] {
  return questions.filter((_, questionIndex) => questionIndex !== index);
}

export function addQuestion(
  questions: QuizEditorQuestionViewModel[],
  question: QuizEditorQuestionViewModel,
): QuizEditorQuestionViewModel[] {
  return [...questions, question];
}

export function toggleQuestionType(
  questions: QuizEditorQuestionViewModel[],
  index: number,
  value: 'single' | 'multiple',
): QuizEditorQuestionViewModel[] {
  return questions.map((question, questionIndex) => {
    if (questionIndex !== index) return question;
    const correctAnswerIndexes = getCorrectAnswerIndexes(question);
    const base = withBase(question);
    return value === 'single'
      ? { ...base, type: 'single', correctIndex: correctAnswerIndexes[0] ?? 0 }
      : { ...base, type: 'multiple', correctIndexes: correctAnswerIndexes };
  });
}

export function setSingleCorrect(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  optionIndex: number,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    return { ...withBase(question), type: 'single', correctIndex: optionIndex };
  });
}

export function toggleMultipleCorrect(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  optionIndex: number,
  checked: boolean,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    const current = question.type === 'multiple' ? question.correctIndexes : [];
    const correctIndexes = checked
      ? [...current, optionIndex].sort((a, b) => a - b)
      : current.filter((value) => value !== optionIndex);
    return { ...withBase(question), type: 'multiple', correctIndexes };
  });
}
