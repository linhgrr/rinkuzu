export interface RegisterAccountDto {
  email: string;
  password: string;
  displayName?: string;
  /** Same-origin path to return to after the user verifies and signs in. */
  callbackUrl?: string;
  /** Guest claim tokens this browser holds, so verifying elsewhere still saves the result. */
  guestClaimTokens?: string[];
  /** UI locale of the signup page (`vi` | `en`), stored on the account (RIN-1263). */
  locale?: 'vi' | 'en';
  /** Edge country of the signup request, already sanitised to ISO alpha-2 (RIN-1268). */
  signupCountry?: string;
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
