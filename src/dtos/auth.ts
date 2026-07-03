export interface RegisterAccountDto {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterAccountResponseDto {
  email: string;
}

export interface EmailResponseDto {
  email: string;
}

export interface PasswordResetRequestResultDto {
  email: string;
  requested: true;
}

export interface VerificationResendResultDto {
  email: string;
  requested: true;
}

export interface PasswordResetResultDto {
  email: string;
  passwordReset: true;
}
