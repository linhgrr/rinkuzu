import type { QuizQuestion } from '@/entities/Quiz';
import type {
  QuizAttemptAnswer,
  QuizAttemptEvaluation,
  WrongQuizAttemptQuestion,
} from '@/entities/QuizAttempt';

export class InvalidQuizAttemptAnswersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuizAttemptAnswersError';
  }
}

function invalidAnswer(questionIndex: number, reason: string): never {
  throw new InvalidQuizAttemptAnswersError(
    `Invalid answer at question ${questionIndex + 1}: ${reason}`,
  );
}

function normalizeSingleAnswer(
  answer: QuizAttemptAnswer,
  optionCount: number,
  questionIndex: number,
): number {
  if (typeof answer !== 'number' || !Number.isInteger(answer)) {
    return invalidAnswer(questionIndex, 'single-choice answers must be integers');
  }
  if (answer < -1 || answer >= optionCount) {
    return invalidAnswer(questionIndex, 'single-choice answer is out of range');
  }
  return answer;
}

function normalizeMultipleAnswer(
  answer: QuizAttemptAnswer,
  optionCount: number,
  questionIndex: number,
): number[] {
  if (!Array.isArray(answer)) {
    return invalidAnswer(questionIndex, 'multiple-choice answers must be arrays');
  }
  if (answer.some((optionIndex) => !Number.isInteger(optionIndex))) {
    return invalidAnswer(questionIndex, 'multiple-choice answers must contain integers');
  }
  if (answer.some((optionIndex) => optionIndex < 0 || optionIndex >= optionCount)) {
    return invalidAnswer(questionIndex, 'multiple-choice answer is out of range');
  }
  if (new Set(answer).size !== answer.length) {
    return invalidAnswer(questionIndex, 'multiple-choice answers must not contain duplicates');
  }
  return answer.toSorted((left, right) => left - right);
}

function sameIndexes(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function evaluateQuizAttempt(
  questions: QuizQuestion[],
  answers: QuizAttemptAnswer[],
): QuizAttemptEvaluation {
  if (questions.length === 0) {
    throw new TypeError('Cannot evaluate a quiz without questions');
  }
  if (answers.length !== questions.length) {
    throw new InvalidQuizAttemptAnswersError('Answer count must match question count');
  }

  const normalizedAnswers: QuizAttemptAnswer[] = [];
  const wrongQuestions: WrongQuizAttemptQuestion[] = [];
  let correctAnswers = 0;

  questions.forEach((question, questionIndex) => {
    const answer = answers[questionIndex];
    if (answer === undefined) {
      return invalidAnswer(questionIndex, 'answer is missing');
    }

    let normalizedAnswer: QuizAttemptAnswer;
    let isCorrect: boolean;
    if (question.type === 'single') {
      normalizedAnswer = normalizeSingleAnswer(answer, question.options.length, questionIndex);
      if (!Number.isInteger(question.correctIndex)) {
        throw new TypeError(`Quiz question ${question.id} has no valid correctIndex`);
      }
      isCorrect = normalizedAnswer === question.correctIndex;
    } else {
      normalizedAnswer = normalizeMultipleAnswer(answer, question.options.length, questionIndex);
      if (!question.correctIndexes?.length) {
        throw new TypeError(`Quiz question ${question.id} has no valid correctIndexes`);
      }
      const correctIndexes = question.correctIndexes.toSorted((left, right) => left - right);
      isCorrect = sameIndexes(normalizedAnswer, correctIndexes);
    }

    normalizedAnswers.push(normalizedAnswer);
    if (isCorrect) {
      correctAnswers += 1;
    } else {
      wrongQuestions.push({ questionId: question.id, question });
    }
  });

  const totalQuestions = questions.length;
  return {
    answers: normalizedAnswers,
    correctAnswers,
    score: Math.round((correctAnswers / totalQuestions) * 100),
    totalQuestions,
    wrongQuestions,
  };
}
