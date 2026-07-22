import { getCorrectAnswerIndexes } from '@/lib/quiz/answer-text';
import type {
  QuizEditorQuestionInputViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';
import type { QuestionType } from '@/shared/constants/question-type';
import { MAX_OPTION_COUNT, MIN_OPTION_COUNT } from '@/lib/validation/question';

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
      ...copyQuizQuestionContentFields(question),
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
    ...copyQuizQuestionContentFields(question),
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

export function addOption(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (index !== questionIndex || question.options.length >= MAX_OPTION_COUNT) return question;
    return {
      ...question,
      options: [...question.options, ''],
      optionImages: [
        ...(question.optionImages ?? question.options.map(() => undefined)),
        undefined,
      ],
    };
  });
}

export function removeOption(
  questions: QuizEditorQuestionViewModel[],
  questionIndex: number,
  optionIndex: number,
): QuizEditorQuestionViewModel[] {
  return questions.map((question, index) => {
    if (
      index !== questionIndex ||
      question.options.length <= MIN_OPTION_COUNT ||
      optionIndex < 0 ||
      optionIndex >= question.options.length
    ) {
      return question;
    }

    const base = {
      ...withBase(question),
      options: question.options.filter((_, index) => index !== optionIndex),
      optionImages: (question.optionImages ?? question.options.map(() => undefined)).filter(
        (_, index) => index !== optionIndex,
      ),
    };
    if (question.type === 'single') {
      const lastIndex = base.options.length - 1;
      const correctIndex =
        question.correctIndex === optionIndex
          ? Math.min(optionIndex, lastIndex)
          : question.correctIndex > optionIndex
            ? question.correctIndex - 1
            : question.correctIndex;
      return { ...base, type: 'single' as const, correctIndex };
    }

    const correctIndexes = question.correctIndexes.reduce<number[]>((indexes, value) => {
      if (value !== optionIndex) indexes.push(value > optionIndex ? value - 1 : value);
      return indexes;
    }, []);
    return { ...base, type: 'multiple' as const, correctIndexes };
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

export function insertQuestion(
  questions: QuizEditorQuestionViewModel[],
  index: number,
  question: QuizEditorQuestionViewModel,
): QuizEditorQuestionViewModel[] {
  const insertionIndex = Math.max(0, Math.min(index, questions.length));
  return [...questions.slice(0, insertionIndex), question, ...questions.slice(insertionIndex)];
}

export function toggleQuestionType(
  questions: QuizEditorQuestionViewModel[],
  index: number,
  value: QuestionType,
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
