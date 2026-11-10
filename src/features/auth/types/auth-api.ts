export interface AuthActionResult {
  message?: string;
}

export interface VerifyEmailResult extends AuthActionResult {
  /** The quiz the verification claimed from this learner's guest draft (RIN-1487). */
  claimedQuizSlug?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  callbackUrl?: string;
  guestClaimTokens?: string[];
  guestDraftTokens?: string[];
  /** Page locale, stored on the account for emails (RIN-1263). */
  locale?: string;
}
