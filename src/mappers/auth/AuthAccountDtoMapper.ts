import type {
  EmailResponseDto,
  PasswordResetRequestResultDto,
  PasswordResetResultDto,
  RegisterAccountResponseDto,
  VerificationResendResultDto,
} from '@/dtos/auth';

export class AuthAccountDtoMapper {
  static toRegisterResponse(email: string): RegisterAccountResponseDto {
    return { email };
  }

  static toEmailResponse(email: string): EmailResponseDto {
    return { email };
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
