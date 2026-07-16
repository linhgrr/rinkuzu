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
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

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
  if (question.correctIndexes.length !== userAnswer.length) return false;
  const userAnswerSet = new Set(userAnswer);
  return question.correctIndexes.every((index) => userAnswerSet.has(index));
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
        ...(quiz.description !== undefined && { description: quiz.description }),
      },
    };
  }

  static toDetailDto(attempt: Attempt): AttemptDetailDto {
    const quiz = requireQuizSnapshot(attempt);
    if (!quiz.questions) {
      throw new TypeError('attempt.quiz.questions is required');
    }
    const historyStatus =
      attempt.answers.length === quiz.questions.length ? 'complete' : 'quiz_modified';
    const questions =
      historyStatus === 'complete'
        ? quiz.questions.map((question, index) =>
            UserAttemptDtoMapper.toQuestionDetailDto(question, attempt.answers[index]),
          )
        : [];

    return {
      id: attempt.id,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      takenAt: serializeDate(attempt.takenAt, 'attempt.takenAt'),
      answers: historyStatus === 'complete' ? attempt.answers : [],
      historyStatus,
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        ...(quiz.description !== undefined && { description: quiz.description }),
        questions,
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
    const base = {
      ...copyQuizQuestionFields(question),
      userAnswer,
      isCorrect: isCorrectAnswer(question, userAnswer),
    };

    return question.type === 'single'
      ? { ...base, type: 'single', correctIndex: question.correctIndex }
      : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
  }
}
