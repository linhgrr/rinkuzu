import { IUserService } from '@/interfaces/services/IUserService';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type {
  AttemptOwnerIdentity,
  IAttemptRepository,
} from '@/interfaces/repositories/IAttemptRepository';
import type { AttemptOwner } from '@/interfaces/services/IUserService';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicProfileQueryDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';
import { logger } from '@/lib/logger';
import { PublicProfileDtoMapper } from '@/mappers/user/PublicProfileDtoMapper';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';
import type { PremiumAccessContext, PremiumAccessDecision } from '@/entities/PremiumQuiz';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';

interface PremiumAttemptAccessPolicy {
  canAccessAttempt(
    context: PremiumAccessContext,
    quizId: string,
    submissionId: string,
    snapshotHash: string,
  ): Promise<PremiumAccessDecision>;
}

function toAttemptOwnerIdentity(owner: AttemptOwner): AttemptOwnerIdentity {
  if (owner.userId !== undefined) return { userId: owner.userId };
  if (owner.guestClaimToken !== undefined) {
    return { guestClaimTokenHash: hashGuestClaimToken(owner.guestClaimToken) };
  }
  return { guestEmail: owner.guestEmail };
}

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private quizRepository: IQuizRepository,
    private premiumAccessPolicy?: PremiumAttemptAccessPolicy,
  ) {}

  async getPublicProfile(
    userId: string,
    options: PublicProfileQueryDto,
  ): Promise<ServiceResult<PublicUserProfileDto>> {
    try {
      const [user, quizzes] = await Promise.all([
        this.userRepository.findPublicProfileById(userId),
        this.quizRepository.findPublicByAuthor(userId, {
          page: options.page,
          limit: 12,
        }),
      ]);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404,
        };
      }

      return {
        success: true,
        data: PublicProfileDtoMapper.toDto(user, quizzes.items, quizzes.pagination),
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
    userId: string,
    options: UserAttemptListQueryDto,
  ): Promise<UserAttemptListDto> {
    try {
      const result = await this.attemptRepository.findByUser(userId, options);
      return UserAttemptDtoMapper.toListDto(result.items, result.pagination);
    } catch (error) {
      logger.error({ error }, 'Get user attempts error');
      throw error;
    }
  }

  async getAttemptDetails(
    attemptId: string,
    owner: AttemptOwner,
  ): Promise<ServiceResult<AttemptDetailDto>> {
    try {
      const attempt = await this.attemptRepository.findByIdWithQuiz(
        attemptId,
        toAttemptOwnerIdentity(owner),
      );

      if (!attempt) {
        return {
          success: false,
          error: 'Attempt not found',
          statusCode: 404,
        };
      }

      const quiz = typeof attempt.quiz === 'object' ? attempt.quiz : null;
      let canReadPremiumContent = true;
      if (attempt.premiumSubmissionId !== undefined && attempt.premiumSnapshotHash !== undefined) {
        canReadPremiumContent =
          owner.userId !== undefined &&
          quiz !== null &&
          this.premiumAccessPolicy !== undefined &&
          (await this.premiumAccessPolicy.canAccessAttempt(
            { userId: owner.userId, ...(owner.role === undefined ? {} : { role: owner.role }) },
            quiz.id,
            attempt.premiumSubmissionId,
            attempt.premiumSnapshotHash,
          ));
      }

      return {
        success: true,
        data: UserAttemptDtoMapper.toDetailDto(attempt, !canReadPremiumContent),
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
