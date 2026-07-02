import { IUserService } from '@/interfaces/services/IUserService';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';
import { logger } from '@/lib/logger';
import { PublicProfileDtoMapper } from '@/mappers/user/PublicProfileDtoMapper';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';

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
      return UserAttemptDtoMapper.toListDto(result.items, result.pagination);
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

      return {
        success: true,
        data: UserAttemptDtoMapper.toDetailDto(attempt),
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
