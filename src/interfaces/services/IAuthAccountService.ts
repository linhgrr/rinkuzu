import type {
  PasswordResetRequestResultDto,
  PasswordResetResultDto,
  RegisterAccountDto,
  RegisterAccountResponseDto,
  VerificationResendResultDto,
  VerifyEmailResponseDto,
} from '@/dtos/auth';
import type { AuthRequestContext } from '@/entities/AuthAccount';
import type { ServiceResult } from '@/interfaces/services/types';

export interface IAuthAccountService {
  register(
    input: RegisterAccountDto,
    context: AuthRequestContext,
  ): Promise<ServiceResult<RegisterAccountResponseDto>>;

  verifyEmail(
    rawToken: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<VerifyEmailResponseDto>>;

  requestPasswordReset(
    email: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<PasswordResetRequestResultDto>>;

  resendVerification(
    email: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<VerificationResendResultDto>>;

  resetPassword(
    rawToken: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<PasswordResetResultDto>>;
}
