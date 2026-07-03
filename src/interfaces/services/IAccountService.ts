import type {
  AccountProfileDto,
  AvatarDeleteResultDto,
  AvatarResponseDto,
  AvatarUploadDto,
  PasswordChangeResultDto,
  UpdateAccountProfileDto,
} from '@/dtos/account';
import type { ServiceResult } from '@/interfaces/services/types';

export interface IAccountService {
  getProfile(email: string): Promise<ServiceResult<AccountProfileDto>>;

  updateProfile(
    email: string,
    update: UpdateAccountProfileDto,
  ): Promise<ServiceResult<AccountProfileDto>>;

  changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ServiceResult<PasswordChangeResultDto>>;

  uploadAvatar(email: string, avatar: AvatarUploadDto): Promise<ServiceResult<AvatarResponseDto>>;

  deleteAvatar(email: string): Promise<ServiceResult<AvatarDeleteResultDto>>;
}
