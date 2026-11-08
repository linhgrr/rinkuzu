import type {
  AttemptDetailDto,
  AttemptQuestionDetailDto,
  UserAttemptHistorySummaryDto,
  UserAttemptListDto,
  UserAttemptSummaryDto,
} from '@/dtos/user';
import type { PaginationMeta } from '@/dtos/common';
import type { Attempt, AttemptAnswer, AttemptQuizSnapshot } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';
import { serializeDate } from '@/lib/date-serialization';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';
import { countMissedAnswers } from '@/services/quiz/quiz-retry';

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

/** Share facts about the live quiz, resolved by the service (RIN-1179). */
interface AttemptQuizShareFacts {
  shareable: boolean;
  questionCount: number;
}

export class UserAttemptDtoMapper {
  static toListDto(
    attempts: Attempt[],
    pagination: PaginationMeta,
    summary: UserAttemptHistorySummaryDto,
  ): UserAttemptListDto {
    return {
      attempts: attempts.map(UserAttemptDtoMapper.toSummaryDto),
      pagination,
      summary: {
        totalAttempts: summary.totalAttempts,
        averageScore: summary.averageScore,
        needsWorkCount: summary.needsWorkCount,
      },
    };
  }

  static toSummaryDto(attempt: Attempt): UserAttemptSummaryDto {
    const quiz = requireQuizSnapshot(attempt);
    return {
      id: attempt.id,
      score: attempt.score,
      takenAt: serializeDate(attempt.takenAt, 'attempt.takenAt'),
      totalQuestions: attempt.totalQuestions,
      ...(attempt.mode === 'quick' && { mode: 'quick' as const }),
      quiz: {
        title: quiz.title,
        slug: quiz.slug,
        ...(quiz.description !== undefined && { description: quiz.description }),
      },
    };
  }

  static toDetailDto(
    attempt: Attempt,
    contentLocked = false,
    nextQuiz: AttemptDetailDto['nextQuiz'] = null,
    share?: AttemptQuizShareFacts,
  ): AttemptDetailDto {
    const quiz = requireQuizSnapshot(attempt);
    if (!quiz.questions) {
      throw new TypeError('attempt.quiz.questions is required');
    }
    const shareFacts = share ?? { shareable: false, questionCount: quiz.questions.length };
    const historyStatus: AttemptDetailDto['historyStatus'] = contentLocked
      ? 'content_locked'
      : attempt.answers.length === quiz.questions.length
        ? 'complete'
        : 'quiz_modified';
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
        id: quiz.id,
        title: quiz.title,
        slug: quiz.slug,
        ...(quiz.description !== undefined && { description: quiz.description }),
        questions,
        shareable: shareFacts.shareable && !contentLocked,
        questionCount: shareFacts.questionCount,
      },
      missedCount: countMissedAnswers(attempt),
      nextQuiz,
      ...(attempt.retryOfAttemptId !== undefined && { retryOfAttemptId: attempt.retryOfAttemptId }),
      ...(attempt.questionIndices !== undefined && { questionIndices: attempt.questionIndices }),
      ...(attempt.mode === 'quick' && { mode: 'quick' as const }),
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
