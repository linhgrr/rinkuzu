import { ServiceResult } from '@/interfaces/services/types';
import type {
  AttemptDetailDto,
  PublicUserProfileDto,
  UserAttemptListDto,
  UserAttemptListQueryDto,
} from '@/dtos/user';

export interface IUserService {
  getUserAttempts(userEmail: string, options: UserAttemptListQueryDto): Promise<UserAttemptListDto>;
  getAttemptDetails(attemptId: string, userEmail: string): Promise<ServiceResult<AttemptDetailDto>>;

  getPublicProfile(userId: string): Promise<ServiceResult<PublicUserProfileDto>>;
}
