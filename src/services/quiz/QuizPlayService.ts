import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import { type IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import { ServiceResult } from '@/interfaces/services/types';
import type {
  DeleteQuizProgressResponseDto,
  FlashcardQuizDto,
  QuizAttemptResultDto,
  QuizPlayDetailDto,
  QuizProgressResponseDto,
  SavedQuizProgressDto,
  SaveQuizProgressResponseDto,
} from '@/dtos/quiz';
import type { Session } from 'next-auth';
import { checkQuizSourceAccess, requireQuizReadAccess } from './quiz-helpers';
import { logger } from '@/lib/logger';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';
import { QuizProgressDtoMapper } from '@/mappers/quiz/QuizProgressDtoMapper';
import { QuizAttemptDtoMapper } from '@/mappers/quiz/QuizAttemptDtoMapper';
import { QuizFlashcardDtoMapper } from '@/mappers/quiz/QuizFlashcardDtoMapper';
import {
  evaluateQuizAttempt,
  InvalidQuizAttemptAnswersError,
} from '@/services/quiz/quiz-attempt-evaluation';
import type { QuizAttemptAnswer } from '@/entities/QuizAttempt';
import type { Quiz } from '@/entities/Quiz';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { objectIdSchema } from '@/lib/validation/common';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { deriveMissedQuestionIndices } from '@/services/quiz/quiz-retry';
import { isQuickRoundEligible, QUICK_ROUND_SIZE } from '@/shared/constants/quick-round';
import type { QuizEntryAttribution } from '@/shared/constants/starter-quiz';

type RetrySourceAttemptRepository = Pick<IAttemptRepository, 'findByIdWithQuiz'>;

type SubsetAttemptFields =
  | { retryOfAttemptId: string; questionIndices: number[] }
  | { mode: 'quick'; questionIndices: number[] };

const INVALID_QUICK_ROUND = {
  success: false,
  error: 'Invalid quick round',
  statusCode: 400,
  code: 'validation_error',
} as const;

/** The questions a submit is scored against and the attempt fields that record the subset. */
interface AttemptSubset {
  questions: Quiz['questions'];
  subsetFields: SubsetAttemptFields | null;
}

function attemptSubset(
  questions: Quiz['questions'],
  subsetFields: SubsetAttemptFields | null,
): AttemptSubset {
  return { questions, subsetFields };
}

function isValidQuickRound(indices: readonly number[], quizQuestionCount: number): boolean {
  return (
    isQuickRoundEligible(quizQuestionCount) &&
    indices.length === QUICK_ROUND_SIZE &&
    new Set(indices).size === indices.length &&
    indices.every((index) => Number.isInteger(index) && index >= 0 && index < quizQuestionCount)
  );
}

const ATTEMPT_NOT_FOUND = { success: false, error: 'Attempt not found', statusCode: 404 } as const;

interface FlashcardQuizFailureContext {
  logMessage: string;
  errorMessage: string;
}

export class QuizPlayService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private quizProgressRepository: IQuizProgressRepository,
    private quizAttemptProgressRepository: IQuizAttemptProgressRepository,
    private attemptRepository?: RetrySourceAttemptRepository,
  ) {}

  /**
   * Quiz question indices the learner missed in `retryOfAttemptId`, re-derived server-side.
   * Owner only: an attempt of another user, of another quiz, or an unknown id is a 404.
   */
  private async resolveRetryQuestionIndices(
    quiz: Quiz,
    retryOfAttemptId: string,
    userId: string,
  ): Promise<ServiceResult<number[]>> {
    if (!this.attemptRepository || !objectIdSchema.safeParse(retryOfAttemptId).success) {
      return ATTEMPT_NOT_FOUND;
    }
    const source = await this.attemptRepository.findByIdWithQuiz(retryOfAttemptId, { userId });
    if (!source || typeof source.quiz !== 'object' || source.quiz.id !== quiz.id) {
      return ATTEMPT_NOT_FOUND;
    }
    const indices = deriveMissedQuestionIndices(source, quiz.questions);
    if (indices.length === 0) {
      return {
        success: false,
        error: 'Nothing to retry',
        statusCode: 409,
        code: 'nothing_to_retry',
      };
    }
    return { success: true, data: indices };
  }

  /**
   * The questions a submit is scored against: the whole quiz, a quick round (RIN-936) or a
   * retry of missed questions (RIN-914), plus the attempt fields that record the subset.
   */
  private async resolveAttemptSubset(
    quiz: Quiz,
    authenticatedUserId: string | undefined,
    retryOfAttemptId: string | undefined,
    quickQuestionIndices: number[] | undefined,
  ): Promise<ServiceResult<AttemptSubset>> {
    if (quickQuestionIndices !== undefined) {
      // The learner picks the 10; the server only checks them and scores in play order.
      if (
        retryOfAttemptId !== undefined ||
        !isValidQuickRound(quickQuestionIndices, quiz.questions.length)
      ) {
        return INVALID_QUICK_ROUND;
      }
      return {
        success: true,
        data: attemptSubset(
          quickQuestionIndices.flatMap((index) => quiz.questions[index] ?? []),
          { mode: 'quick', questionIndices: quickQuestionIndices },
        ),
      };
    }
    if (retryOfAttemptId === undefined) {
      return { success: true, data: attemptSubset(quiz.questions, null) };
    }
    if (!authenticatedUserId) {
      return {
        success: false,
        error: 'Authentication required',
        statusCode: 401,
        code: 'unauthorized',
      };
    }
    const retry = await this.resolveRetryQuestionIndices(
      quiz,
      retryOfAttemptId,
      authenticatedUserId,
    );
    if (!retry.success) return retry;
    return {
      success: true,
      data: attemptSubset(
        retry.data.flatMap((index) => quiz.questions[index] ?? []),
        { retryOfAttemptId, questionIndices: retry.data },
      ),
    };
  }

  /** `GET /api/quiz/<slug>/play?retryOf=<attemptId>`: only the missed questions, in order. */
  async getRetryQuizForPlay(
    slug: string,
    retryOfAttemptId: string,
    userId?: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>> {
    if (!userId) {
      return {
        success: false,
        error: 'Authentication required',
        statusCode: 401,
        code: 'unauthorized',
      };
    }
    try {
      const access = await requireQuizReadAccess(
        await this.quizRepository.findBySlug(slug),
        userId,
        userRole,
      );
      if (!access.success) return access;
      const quiz = access.data;

      const retry = await this.resolveRetryQuestionIndices(quiz, retryOfAttemptId, userId);
      if (!retry.success) return retry;

      return {
        success: true,
        data: QuizDetailDtoMapper.toRetryPlayDetail(quiz, retryOfAttemptId, retry.data),
      };
    } catch (error) {
      logger.error({ error }, 'Error in getRetryQuizForPlay');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  private async resolveQuizForRead(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<Quiz>> {
    return requireQuizReadAccess(
      await this.quizRepository.findSummaryBySlug(slug),
      userId,
      userRole,
    );
  }

  private async getFlashcardQuiz(
    slug: string,
    session: Session | null | undefined,
    failureContext: FlashcardQuizFailureContext,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    try {
      const quiz = await this.quizRepository.findForPlay(slug);
      const access = await requireQuizReadAccess(quiz, session?.user?.id, session?.user?.role);
      if (!access.success) return access;

      return {
        success: true,
        data: QuizFlashcardDtoMapper.toDto(access.data),
      };
    } catch (error) {
      logger.error({ error }, failureContext.logMessage);
      return {
        success: false,
        error: failureContext.errorMessage,
        statusCode: 500,
      };
    }
  }

  async getSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizProgressResponseDto>> {
    try {
      const access = await this.resolveQuizForRead(slug, userId, userRole);
      if (!access.success) return access;

      const progress = await this.quizProgressRepository.findByUserAndQuiz(userId, access.data.id);
      return {
        success: true,
        data: QuizProgressDtoMapper.toGetResponse(progress),
      };
    } catch (error) {
      logger.error({ error, slug, userId }, 'Get quiz progress error');
      return { success: false, error: 'Failed to get quiz progress', statusCode: 500 };
    }
  }

  async saveQuizProgress(
    slug: string,
    userId: string,
    progress: SavedQuizProgressDto,
    userRole?: string,
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>> {
    try {
      const access = await this.resolveQuizForRead(slug, userId, userRole);
      if (!access.success) return access;

      await this.quizProgressRepository.upsert(userId, access.data.id, progress);
      return { success: true, data: QuizProgressDtoMapper.toSaveResponse() };
    } catch (error) {
      logger.error({ error, slug, userId }, 'Save quiz progress error');
      return { success: false, error: 'Failed to save quiz progress', statusCode: 500 };
    }
  }

  async deleteSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>> {
    try {
      const access = await this.resolveQuizForRead(slug, userId, userRole);
      if (!access.success) return access;

      await this.quizProgressRepository.deleteByUserAndQuiz(userId, access.data.id);
      return { success: true, data: QuizProgressDtoMapper.toDeleteResponse() };
    } catch (error) {
      logger.error({ error, slug, userId }, 'Delete quiz progress error');
      return { success: false, error: 'Failed to delete quiz progress', statusCode: 500 };
    }
  }

  async resolveSlugAlias(slug: string): Promise<string | null> {
    const canonical = await this.quizRepository.findCanonicalSlugByAlias(slug);
    return canonical && canonical !== slug ? canonical : null;
  }

  async getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>> {
    try {
      const access = await requireQuizReadAccess(
        await this.quizRepository.findBySlug(slug),
        userId,
        userRole,
      );
      if (!access.success) return access;

      return { success: true, data: QuizDetailDtoMapper.toPlayDetail(access.data) };
    } catch (error) {
      logger.error({ error }, 'Error in getQuizForPlay');
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async submitQuizAttempt(
    slug: string,
    answers: QuizAttemptAnswer[],
    idempotencyKey: string,
    session: Session | null,
    retryOfAttemptId?: string,
    guestClaimToken?: string,
    quickQuestionIndices?: number[],
    attribution?: QuizEntryAttribution,
  ): Promise<ServiceResult<QuizAttemptResultDto>> {
    try {
      const quiz = await this.quizRepository.findForPlay(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const userIdFromSession = session?.user?.id;
      const userRole = session?.user?.role;

      const sourceAccessError = await checkQuizSourceAccess(quiz, userIdFromSession, userRole);
      if (sourceAccessError) return sourceAccessError;

      let authenticatedUserId: string | undefined;
      let guestClaimTokenHash: string | undefined;
      if (session?.user?.id) {
        authenticatedUserId = session.user.id;
      } else if (session?.user?.email) {
        const user = await this.userRepository.findByEmail(session.user.email);
        if (!user) {
          return {
            success: false,
            error: 'User not found',
            statusCode: 404,
          };
        }
        authenticatedUserId = user.id;
      } else if (guestClaimToken) {
        // RIN-912: no email is collected; only the token's hash identifies the guest.
        guestClaimTokenHash = hashGuestClaimToken(guestClaimToken);
      } else {
        return {
          success: false,
          error: 'User identification required',
          statusCode: 400,
        };
      }

      const subset = await this.resolveAttemptSubset(
        quiz,
        authenticatedUserId,
        retryOfAttemptId,
        quickQuestionIndices,
      );
      if (!subset.success) return subset;
      const { questions, subsetFields } = subset.data;

      const evaluation = evaluateQuizAttempt(questions, answers);

      const attemptIdentity = authenticatedUserId
        ? { userId: authenticatedUserId }
        : guestClaimTokenHash
          ? { guestClaimTokenHash }
          : null;
      if (!attemptIdentity) {
        throw new TypeError('Attempt identity is required');
      }

      const attempt = await this.quizAttemptProgressRepository.recordSubmittedAttempt({
        ...attemptIdentity,
        idempotencyKey,
        quizId: quiz.id,
        quizSlug: quiz.slug,
        quizSnapshot: {
          integrity: 'complete',
          title: quiz.title,
          slug: quiz.slug,
          ...(quiz.description === undefined ? {} : { description: quiz.description }),
          questions,
        },
        ...subsetFields,
        answers: evaluation.answers,
        score: evaluation.score,
        correctAnswers: evaluation.correctAnswers,
        totalQuestions: evaluation.totalQuestions,
        wrongQuestions: evaluation.wrongQuestions,
        takenAt: new Date(),
        ...(attribution?.entry === undefined ? {} : { entry: attribution.entry }),
        ...(attribution?.post === undefined ? {} : { post: attribution.post }),
        ...(attribution?.topic === undefined ? {} : { topic: attribution.topic }),
      });

      return {
        success: true,
        data: QuizAttemptDtoMapper.toResultDto(
          attempt.id,
          attempt.score,
          attempt.correctAnswers,
          attempt.totalQuestions,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidQuizAttemptAnswersError) {
        return { success: false, error: error.message, statusCode: 400 };
      }
      if (error instanceof QuizAttemptIdempotencyConflictError) {
        return { success: false, error: error.message, statusCode: 409 };
      }
      logger.error({ error }, 'Submit quiz attempt error');
      return {
        success: false,
        error: 'Failed to submit quiz attempt',
        statusCode: 500,
      };
    }
  }

  async getQuizFlashcards(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    return this.getFlashcardQuiz(slug, session, {
      logMessage: 'Get quiz flashcards error',
      errorMessage: 'Failed to get quiz flashcards',
    });
  }

  async getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    return this.getFlashcardQuiz(slug, session, {
      logMessage: 'Get quiz for flashcards error',
      errorMessage: 'Failed to get quiz for flashcards',
    });
  }
}
