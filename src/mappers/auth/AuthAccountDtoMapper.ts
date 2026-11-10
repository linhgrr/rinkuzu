import type {
  PasswordResetRequestResultDto,
  PasswordResetResultDto,
  RegisterAccountResponseDto,
  VerificationResendResultDto,
  VerifyEmailResponseDto,
} from '@/dtos/auth';

export class AuthAccountDtoMapper {
  static toRegisterResponse(email: string): RegisterAccountResponseDto {
    return { email };
  }

  static toVerifyEmailResponse(
    email: string,
    claimedQuizSlug: string | null,
  ): VerifyEmailResponseDto {
    return claimedQuizSlug ? { email, claimedQuizSlug } : { email };
  }

  static toPasswordResetRequestResult(email: string): PasswordResetRequestResultDto {
    return { email, requested: true };
  }

  static toVerificationResendResult(email: string): VerificationResendResultDto {
    return { email, requested: true };
  }

  static toPasswordResetResult(email: string): PasswordResetResultDto {
    return { email, passwordReset: true };
  }
}
