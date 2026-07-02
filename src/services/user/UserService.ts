import { IUserService } from '@/interfaces/services/IUserService';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  AttemptQuestionDetailDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
  UserAttemptSummaryDto,
} from '@/dtos/user';
import { logger } from '@/lib/logger';
import { PublicProfileDtoMapper } from '@/mappers/user/PublicProfileDtoMapper';

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private quizRepository: IQuizRepository,
  ) {}

  async getPublicProfile(userId: string): Promise<ServiceResult<PublicUserProfileDto>> {
    try {
      const user = await this.userRepository.findPublicProfileById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404,
        };
      }

      const quizzes = await this.quizRepository.findPublicByAuthor(userId);

      return {
        success: true,
        data: PublicProfileDtoMapper.toDto(user, quizzes),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Get public profile error');
      return {
        success: false,
        error: 'Failed to get public profile',
        statusCode: 500,
      };
    }
  }

  async getUserAttempts(
    userEmail: string,
    options: UserAttemptListQueryDto,
  ): Promise<UserAttemptListDto> {
    try {
      // Find user first
      const user = await this.userRepository.findByEmail(userEmail);

      if (!user) {
        throw new Error('User not found');
      }

      const result = await this.attemptRepository.findByUser(user.id, options);

      const formattedAttempts: UserAttemptSummaryDto[] = result.items.map((attempt) => {
        const populatedQuiz =
          typeof attempt.quiz === 'object' && attempt.quiz !== null ? attempt.quiz : null;
        if (!populatedQuiz) {
          throw new TypeError('attempt.quiz is required');
        }
        return {
          id: attempt.id,
          score: attempt.score,
          takenAt: attempt.takenAt.toISOString(),
          totalQuestions: attempt.totalQuestions,
          quiz: {
            title: populatedQuiz.title,
            slug: populatedQuiz.slug,
            description: populatedQuiz.description,
          },
        };
      });

      return {
        attempts: formattedAttempts,
        pagination: result.pagination,
      };
    } catch (error) {
      logger.error({ error }, 'Get user attempts error');
      throw error;
    }
  }

  async getAttemptDetails(
    attemptId: string,
    userEmail: string,
  ): Promise<ServiceResult<AttemptDetailDto>> {
    try {
      // Find user
      const user = await this.userRepository.findByEmail(userEmail);
      const owner = user ? { userId: user.id } : { guestEmail: userEmail };

      // Get attempt with quiz details
      const attempt = await this.attemptRepository.findByIdWithQuiz(attemptId, owner);

      if (!attempt) {
        return {
          success: false,
          error: 'Attempt not found',
          statusCode: 404,
        };
      }

      const populatedQuiz =
        typeof attempt.quiz === 'object' && attempt.quiz !== null ? attempt.quiz : null;
      if (!populatedQuiz) {
        throw new TypeError('attempt.quiz is required');
      }
      if (!populatedQuiz.questions) {
        throw new TypeError('attempt.quiz.questions is required');
      }
      const answers = attempt.answers;

      const questions: AttemptQuestionDetailDto[] = populatedQuiz.questions.map(
        (question, index) => {
          const userAnswer = answers[index] ?? -1;
          let isCorrect = false;
          if (question.type === 'single') {
            isCorrect = userAnswer === question.correctIndex;
          } else if (Array.isArray(userAnswer) && Array.isArray(question.correctIndexes)) {
            isCorrect =
              question.correctIndexes.length === userAnswer.length &&
              question.correctIndexes.every((idx) => userAnswer.includes(idx));
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
            isCorrect,
          };
        },
      );

      return {
        success: true,
        data: {
          id: attempt.id,
          score: attempt.score,
          takenAt: attempt.takenAt.toISOString(),
          answers,
          quiz: {
            title: populatedQuiz.title,
            slug: populatedQuiz.slug,
            description: populatedQuiz.description,
            questions,
          },
        },
      };
    } catch (error) {
      logger.error({ error }, 'Get attempt details error');
      return {
        success: false,
        error: 'Failed to get attempt details',
        statusCode: 500,
      };
    }
  }
}
