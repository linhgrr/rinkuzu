import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type {
  IQuizAttemptProgressRepository,
  WrongQuizAttemptQuestion,
} from '@/interfaces/repositories/IQuizAttemptProgressRepository';
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
import { checkPrivateQuizAccess } from './quiz-helpers';
import { logger } from '@/lib/logger';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';
import { QuizProgressDtoMapper } from '@/mappers/quiz/QuizProgressDtoMapper';
import { QuizAttemptDtoMapper } from '@/mappers/quiz/QuizAttemptDtoMapper';
import { QuizFlashcardDtoMapper } from '@/mappers/quiz/QuizFlashcardDtoMapper';

type Answer = number | number[];

export class QuizPlayService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private quizProgressRepository: IQuizProgressRepository,
    private quizAttemptProgressRepository?: IQuizAttemptProgressRepository,
  ) {}

  private async resolveQuizId(slug: string): Promise<string | null> {
    return this.quizRepository.findIdBySlug(slug);
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
    answers: Answer[],
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
        guestEmail = userEmail;
      } else {
        return {
          success: false,
          error: 'User identification required',
          statusCode: 400,
        };
      }

      // Validate answers format
      if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid answers format',
          statusCode: 400,
        };
      }

      // Format answers according to validation rules
      const formattedAnswers: Answer[] = answers.map((answer, index) => {
        const question = quiz.questions[index];
        if (!question) return -1;

        if (question.type === 'single') {
          // Single choice: -1 for unanswered, >= 0 for answered
          if (answer === -1) return -1;
          return typeof answer === 'number' && answer >= 0 ? answer : -1;
        } else if (question.type === 'multiple') {
          // Multiple choice: empty array for unanswered, array of >= 0 for answered
          if (!Array.isArray(answer) || answer.length === 0) {
            return [];
          }
          return answer.filter((a): a is number => typeof a === 'number' && a >= 0);
        }
        return answer;
      });

      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;

      for (let i = 0; i < totalQuestions; i++) {
        const question = quiz.questions[i];
        if (!question) continue;
        const userAnswer = formattedAnswers[i];

        if (question.type === 'single') {
          if (userAnswer === question.correctIndex) {
            correctAnswers++;
          }
        } else if (question.type === 'multiple') {
          const userAnswers = Array.isArray(userAnswer) ? userAnswer.toSorted() : [];
          const correctAnswers_q = Array.isArray(question.correctIndexes)
            ? question.correctIndexes.toSorted()
            : [];

          if (JSON.stringify(userAnswers) === JSON.stringify(correctAnswers_q)) {
            correctAnswers++;
          }
        }
      }

      const score = Math.round((correctAnswers / totalQuestions) * 100);

      const attemptIdentity = authenticatedUserId
        ? { userId: authenticatedUserId }
        : guestEmail
          ? { guestEmail }
          : null;
      if (!attemptIdentity) {
        throw new TypeError('Attempt identity is required');
      }

      const attempt = await this.attemptRepository.create({
        ...attemptIdentity,
        quizId: quiz.id,
        answers: formattedAnswers,
        score,
        totalQuestions,
        takenAt: new Date(),
      });

      // === Update gamification stats (logged-in users only) ===
      if (authenticatedUserId) {
        const wrongQuestions: WrongQuizAttemptQuestion[] = [];

        for (let i = 0; i < totalQuestions; i++) {
          const question = quiz.questions[i];
          if (!question) continue;
          const userAnswer = formattedAnswers[i] ?? -1;
          let isCorrect = false;

          if (question.type === 'single') {
            isCorrect = userAnswer === question.correctIndex;
          } else if (question.type === 'multiple') {
            const userAnswers = Array.isArray(userAnswer) ? userAnswer.toSorted() : [];
            const correctAnswers_q = Array.isArray(question.correctIndexes)
              ? question.correctIndexes.toSorted()
              : [];
            isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers_q);
          }

          if (!isCorrect) {
            wrongQuestions.push({ index: i, questionId: question.id, question, userAnswer });
          }
        }

        await this.quizAttemptProgressRepository?.recordSubmittedAttempt({
          userId: authenticatedUserId,
          quizSlug: slug,
          totalQuestions,
          correctAnswers,
          wrongQuestions,
        });

        // Clear any saved in-progress state now that the attempt is submitted.
        try {
          await this.quizProgressRepository.deleteByUserAndQuiz(authenticatedUserId, quiz.id);
        } catch (error) {
          logger.warn({ error }, 'Failed to clear quiz progress after submit');
        }
      }

      return {
        success: true,
        data: QuizAttemptDtoMapper.toResultDto(attempt.id, score, correctAnswers, totalQuestions),
      };
    } catch (error) {
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
    try {
      const quiz = await this.quizRepository.findForPlay(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(
        quiz,
        session?.user?.id,
        session?.user?.role,
      );
      if (privateAccessError) return privateAccessError;

      return {
        success: true,
        data: QuizFlashcardDtoMapper.toDto(quiz),
      };
    } catch (error) {
      logger.error({ error }, 'Get quiz flashcards error');
      return {
        success: false,
        error: 'Failed to get quiz flashcards',
        statusCode: 500,
      };
    }
  }

  async getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    try {
      const quiz = await this.quizRepository.findForPlay(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(
        quiz,
        session?.user?.id,
        session?.user?.role,
      );
      if (privateAccessError) return privateAccessError;

      return {
        success: true,
        data: QuizFlashcardDtoMapper.toDto(quiz),
      };
    } catch (error) {
      logger.error({ error }, 'Get quiz for flashcards error');
      return {
        success: false,
        error: 'Failed to get quiz for flashcards',
        statusCode: 500,
      };
    }
  }
}
