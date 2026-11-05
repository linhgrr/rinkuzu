import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicProfileQueryDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';

export type AttemptOwner =
  | { userId: string; role?: string; guestEmail?: never }
  | { userId?: never; guestEmail: string };

export interface AttemptDetailOptions {
  /** Learner locale, used to pick `nextQuiz`. */
  locale?: string;
}

export interface IUserService {
  getUserAttempts(userId: string, options: UserAttemptListQueryDto): Promise<UserAttemptListDto>;
  getAttemptDetails(
    attemptId: string,
    owner: AttemptOwner,
    options?: AttemptDetailOptions,
  ): Promise<ServiceResult<AttemptDetailDto>>;

  getPublicProfile(
    userId: string,
    options: PublicProfileQueryDto,
  ): Promise<ServiceResult<PublicUserProfileDto>>;
}
