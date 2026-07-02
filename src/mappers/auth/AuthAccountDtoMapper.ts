import type { EmailResponseDto, RegisterAccountResponseDto } from '@/dtos/auth';

export class AuthAccountDtoMapper {
  static toRegisterResponse(email: string): RegisterAccountResponseDto {
    return { email };
  }

  static toEmailResponse(email: string): EmailResponseDto {
    return { email };
  }
}
