import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';

export type AttemptOwner =
  | { userId: string; guestEmail?: never }
  | { userId?: never; guestEmail: string };

export interface IUserService {
  getUserAttempts(userId: string, options: UserAttemptListQueryDto): Promise<UserAttemptListDto>;
  getAttemptDetails(
    attemptId: string,
    owner: AttemptOwner,
  ): Promise<ServiceResult<AttemptDetailDto>>;

  getPublicProfile(userId: string): Promise<ServiceResult<PublicUserProfileDto>>;
}
