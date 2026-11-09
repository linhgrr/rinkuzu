export interface AuthActionResult {
  message?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  callbackUrl?: string;
  /** Page locale, stored on the account for emails (RIN-1263). */
  locale?: string;
}
