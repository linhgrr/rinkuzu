import { ApiResponseError, fetchApiResponse } from '@/lib/api/client';
import { extractApiErrorMeta } from '@/lib/api/error';
import type {
  AuthActionResult,
  RegisterAccountInput,
  ResetPasswordInput,
  VerifyEmailResult,
} from '@/features/auth/types/auth-api';

type AuthSuccessMeta = {
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

async function postAuthAction<TBody extends object>(
  path: string,
  body: TBody,
): Promise<AuthActionResult> {
  const response = await fetchApiResponse<unknown, AuthSuccessMeta>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const message = response.meta?.message;
  return message === undefined ? {} : { message };
}

export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/forgot-password', { email });
}

export async function resetPassword(input: ResetPasswordInput): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/reset-password', input);
}

type VerifyEmailData = {
  claimedQuizSlug?: unknown;
};

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const response = await fetchApiResponse<VerifyEmailData, AuthSuccessMeta>(
    '/api/auth/verify-email',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    },
  );
  const message = response.meta?.message;
  const slug = response.data?.claimedQuizSlug;
  return {
    ...(message === undefined ? {} : { message }),
    ...(typeof slug === 'string' && slug ? { claimedQuizSlug: slug } : {}),
  };
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

export async function registerAccount(input: RegisterAccountInput): Promise<AuthActionResult> {
  return postAuthAction('/api/auth/register', input);
}
