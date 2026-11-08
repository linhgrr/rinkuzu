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
}
