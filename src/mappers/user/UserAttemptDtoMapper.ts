import type {
  AttemptDetailDto,
  AttemptQuestionDetailDto,
  UserAttemptListDto,
  UserAttemptSummaryDto,
} from '@/dtos/user';
import type { PaginationMeta } from '@/dtos/common';
import type { Attempt, AttemptAnswer, AttemptQuizSnapshot } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';
import { serializeDate } from '@/lib/date-serialization';

function requireQuizSnapshot(attempt: Attempt): AttemptQuizSnapshot {
  if (typeof attempt.quiz !== 'object' || attempt.quiz === null) {
    throw new TypeError('attempt.quiz is required');
  }
  return attempt.quiz;
}

function isCorrectAnswer(question: QuizQuestion, userAnswer: AttemptAnswer): boolean {
  if (question.type === 'single') {
    return userAnswer === question.correctIndex;
  }
  if (!Array.isArray(userAnswer)) return false;
  return (
    question.correctIndexes.length === userAnswer.length &&
    question.correctIndexes.every((index) => userAnswer.includes(index))
  );
}

export class UserAttemptDtoMapper {
  static toListDto(attempts: Attempt[], pagination: PaginationMeta): UserAttemptListDto {
    return {
      attempts: attempts.map(UserAttemptDtoMapper.toSummaryDto),
      pagination,
    };
  }

  static toSummaryDto(attempt: Attempt): UserAttemptSummaryDto {
    const quiz = requireQuizSnapshot(attempt);
    return {
      id: attempt.id,
      score: attempt.score,
      takenAt: serializeDate(attempt.takenAt, 'attempt.takenAt'),
      totalQuestions: attempt.totalQuestions,
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        description: quiz.description,
      },
    };
  }

  static toDetailDto(attempt: Attempt): AttemptDetailDto {
    const quiz = requireQuizSnapshot(attempt);
    if (!quiz.questions) {
      throw new TypeError('attempt.quiz.questions is required');
    }
    if (attempt.answers.length !== quiz.questions.length) {
      throw new TypeError('attempt.answers must match quiz questions');
    }

    return {
      id: attempt.id,
      score: attempt.score,
      takenAt: serializeDate(attempt.takenAt, 'attempt.takenAt'),
      answers: attempt.answers,
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        description: quiz.description,
        questions: quiz.questions.map((question, index) =>
          UserAttemptDtoMapper.toQuestionDetailDto(question, attempt.answers[index]),
        ),
      },
    };
  }

  private static toQuestionDetailDto(
    question: QuizQuestion,
    userAnswer: AttemptAnswer | undefined,
  ): AttemptQuestionDetailDto {
    if (userAnswer === undefined) {
      throw new TypeError(`attempt answer for question ${question.id} is required`);
    }
    return {
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      correctIndex: question.correctIndex,
      correctIndexes: question.correctIndexes,
      questionImage: question.questionImage,
      optionImages: question.optionImages,
      userAnswer,
      isCorrect: isCorrectAnswer(question, userAnswer),
    };
  }
}
