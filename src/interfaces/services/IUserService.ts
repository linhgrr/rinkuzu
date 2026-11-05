import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicProfileQueryDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';

export type AttemptOwner =
  | { userId: string; role?: string; guestEmail?: never; guestClaimToken?: never }
  | { userId?: never; guestEmail: string; guestClaimToken?: never }
  | { userId?: never; guestEmail?: never; guestClaimToken: string };

export interface IUserService {
  getUserAttempts(userId: string, options: UserAttemptListQueryDto): Promise<UserAttemptListDto>;
  getAttemptDetails(
    attemptId: string,
    owner: AttemptOwner,
  ): Promise<ServiceResult<AttemptDetailDto>>;

  getPublicProfile(
    userId: string,
    options: PublicProfileQueryDto,
  ): Promise<ServiceResult<PublicUserProfileDto>>;
}
