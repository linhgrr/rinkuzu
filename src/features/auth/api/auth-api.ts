import { ApiResponseError, fetchApiResponse } from '@/lib/api/client';
import { extractApiErrorMeta } from '@/lib/api/error';

type AuthSuccessMeta = {
  message?: string;
};

export type AuthActionResult = {
  message?: string;
};

export class AuthRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Authentication request is rate limited');
    this.name = 'AuthRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function postAuthAction<TBody extends Record<string, unknown>>(
  path: string,
  body: TBody,
): Promise<AuthActionResult> {
  const response = await fetchApiResponse<unknown, AuthSuccessMeta>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { message: response.meta?.message };
}

export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/forgot-password', { email });
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/reset-password', input);
}

export async function verifyEmail(token: string): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/verify-email', { token });
}

export async function resendVerificationEmail(
  email: string,
  defaultRetryAfterSeconds: number,
): Promise<AuthActionResult> {
  try {
    return await postAuthAction('/api/auth/resend-verification', { email });
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 429) {
      const meta =
        error.payload && typeof error.payload === 'object'
          ? extractApiErrorMeta<{ retryAfterSeconds?: number }>(error.payload)
          : null;
      const retryAfterSeconds =
        typeof meta?.retryAfterSeconds === 'number'
          ? meta.retryAfterSeconds
          : defaultRetryAfterSeconds;
      throw new AuthRateLimitError(retryAfterSeconds);
    }
    throw error;
  }
}

export async function registerAccount(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/register', input);
}
