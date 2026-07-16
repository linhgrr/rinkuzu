import type {
  AccountProfileDto,
  AvatarDeleteResultDto,
  AvatarResponseDto,
  AvatarUploadDto,
  PasswordChangeResultDto,
  UpdateAccountProfileDto,
} from '@/dtos/account';
import type { AccountProfile } from '@/entities/Account';
import type { IAccountRepository } from '@/interfaces/repositories/IAccountRepository';
import type { IAccountService } from '@/interfaces/services/IAccountService';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
  type IImageStorage,
} from '@/interfaces/services/IImageStorage';
import type { ServiceResult } from '@/interfaces/services/types';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logger } from '@/lib/logger';
import { AccountDtoMapper } from '@/mappers/user/AccountDtoMapper';

export class AccountService implements IAccountService {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly imageStorage: IImageStorage,
  ) {}

  private async executeProfileOperation(
    email: string,
    operation: () => Promise<AccountProfile | null>,
    logMessage: string,
  ): Promise<ServiceResult<AccountProfileDto>> {
    try {
      const profile = await operation();
      return profile
        ? { success: true, data: AccountDtoMapper.toProfile(profile) }
        : { success: false, error: 'User not found', statusCode: 404 };
    } catch (error) {
      logger.error({ error, email }, logMessage);
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async getProfile(email: string): Promise<ServiceResult<AccountProfileDto>> {
    return this.executeProfileOperation(
      email,
      () => this.accountRepository.findProfileByEmail(email),
      'Get profile error',
    );
  }

  async updateProfile(
    email: string,
    update: UpdateAccountProfileDto,
  ): Promise<ServiceResult<AccountProfileDto>> {
    return this.executeProfileOperation(
      email,
      () => this.accountRepository.updateProfileByEmail(email, update),
      'Update profile error',
    );
  }

  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ServiceResult<PasswordChangeResultDto>> {
    try {
      const credentials = await this.accountRepository.findCredentialsByEmail(email);
      if (!credentials) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }
      if (!credentials.passwordHash) {
        return {
          success: false,
          error: 'Password change is not available for this account',
          statusCode: 400,
        };
      }
      const verification = await verifyPassword(currentPassword, credentials.passwordHash);
      if (!verification.valid) {
        return { success: false, error: 'Current password is incorrect', statusCode: 400 };
      }

      const passwordHash = await hashPassword(newPassword);
      const updated = await this.accountRepository.updatePasswordHash(email, passwordHash);
      return updated
        ? { success: true, data: AccountDtoMapper.toPasswordChangeResult(email) }
        : { success: false, error: 'User not found', statusCode: 404 };
    } catch (error) {
      logger.error({ error, email }, 'Change password error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async uploadAvatar(
    email: string,
    avatar: AvatarUploadDto,
  ): Promise<ServiceResult<AvatarResponseDto>> {
    try {
      const profile = await this.accountRepository.findProfileByEmail(email);
      if (!profile) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }
      const upload = await this.imageStorage.upload({
        bytes: avatar.bytes,
        contentType: avatar.contentType,
        filename: `avatar-${profile.id}`,
      });
      const updated = await this.accountRepository.updateAvatar(email, upload.displayUrl);
      return updated
        ? { success: true, data: AccountDtoMapper.toAvatarResponse(upload.displayUrl) }
        : { success: false, error: 'User not found', statusCode: 404 };
    } catch (error) {
      if (error instanceof ImageStorageConfigurationError) {
        return { success: false, error: error.message, statusCode: 500 };
      }
      if (error instanceof ImageStorageUpstreamError) {
        return { success: false, error: error.message, statusCode: 502 };
      }
      logger.error({ error, email }, 'Upload avatar error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async deleteAvatar(email: string): Promise<ServiceResult<AvatarDeleteResultDto>> {
    try {
      const profile = await this.accountRepository.findProfileByEmail(email);
      if (!profile) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }
      if (profile.avatar) {
        await this.accountRepository.clearAvatar(email);
      }
      return { success: true, data: AccountDtoMapper.toAvatarDeleteResult(email) };
    } catch (error) {
      logger.error({ error, email }, 'Delete avatar error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }
}
