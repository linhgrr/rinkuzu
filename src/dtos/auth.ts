export interface RegisterAccountDto {
  email: string;
  password: string;
  displayName?: string;
  /** Same-origin path to return to after the user verifies and signs in. */
  callbackUrl?: string;
  /** UI locale of the signup page (`vi` | `en`), stored on the account (RIN-1263). */
  locale?: 'vi' | 'en';
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
