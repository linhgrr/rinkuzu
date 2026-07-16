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
import { checkPrivateQuizAccess, requireQuizReadAccess } from './quiz-helpers';
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
  ) {}

  private async resolveQuizId(slug: string): Promise<string | null> {
    return this.quizRepository.findIdBySlug(slug);
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
  ): Promise<ServiceResult<QuizProgressResponseDto>> {
    try {
      const quizId = await this.resolveQuizId(slug);
      if (!quizId) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      const progress = await this.quizProgressRepository.findByUserAndQuiz(userId, quizId);
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
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>> {
    try {
      const quizId = await this.resolveQuizId(slug);
      if (!quizId) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      await this.quizProgressRepository.upsert(userId, quizId, progress);
      return { success: true, data: QuizProgressDtoMapper.toSaveResponse() };
    } catch (error) {
      logger.error({ error, slug, userId }, 'Save quiz progress error');
      return { success: false, error: 'Failed to save quiz progress', statusCode: 500 };
    }
  }

  async deleteSavedQuizProgress(
    slug: string,
    userId: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>> {
    try {
      const quizId = await this.resolveQuizId(slug);
      if (!quizId) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      await this.quizProgressRepository.deleteByUserAndQuiz(userId, quizId);
      return { success: true, data: QuizProgressDtoMapper.toDeleteResponse() };
    } catch (error) {
      logger.error({ error, slug, userId }, 'Delete quiz progress error');
      return { success: false, error: 'Failed to delete quiz progress', statusCode: 500 };
    }
  }

  async getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
      if (privateAccessError) return privateAccessError;

      return { success: true, data: QuizDetailDtoMapper.toPlayDetail(quiz) };
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
    userEmail?: string,
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

      const privateAccessError = await checkPrivateQuizAccess(quiz, userIdFromSession, userRole);
      if (privateAccessError) return privateAccessError;

      let authenticatedUserId: string | undefined;
      let guestEmail: string | undefined;
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
      } else if (userEmail) {
        guestEmail = userEmail.trim().toLowerCase();
      } else {
        return {
          success: false,
          error: 'User identification required',
          statusCode: 400,
        };
      }

      const evaluation = evaluateQuizAttempt(quiz.questions, answers);

      const attemptIdentity = authenticatedUserId
        ? { userId: authenticatedUserId }
        : guestEmail
          ? { guestEmail }
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
          questions: quiz.questions,
        },
        answers: evaluation.answers,
        score: evaluation.score,
        correctAnswers: evaluation.correctAnswers,
        totalQuestions: evaluation.totalQuestions,
        wrongQuestions: evaluation.wrongQuestions,
        takenAt: new Date(),
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
