import type { RegisterAccountDto, RegisterAccountResponseDto, EmailResponseDto } from '@/dtos/auth';
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
  ): Promise<ServiceResult<EmailResponseDto>>;

  requestPasswordReset(email: string, context: AuthRequestContext): Promise<ServiceResult<null>>;

  resendVerification(email: string, context: AuthRequestContext): Promise<ServiceResult<null>>;

  resetPassword(
    rawToken: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<null>>;
}
