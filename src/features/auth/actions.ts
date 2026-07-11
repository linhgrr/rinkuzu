'use server';

import { AuthError, CredentialsSignin } from 'next-auth';

import { signIn, signOut } from '@/auth';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { resolveSafeAuthRedirect } from '@/lib/routing/auth-redirect';
import { loginSchema } from '@/lib/validation/auth';
import type { LoginActionErrorCode, LoginActionState } from '@/features/auth/types/auth-actions';

const PUBLIC_CREDENTIAL_ERROR_CODES = new Set<LoginActionErrorCode>([
  'invalid_credentials',
  'email_not_verified',
  'account_locked',
  'rate_limit_exceeded',
]);

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function readLocale(formData: FormData): Locale {
  const locale = readString(formData, 'locale');
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

function readRetryAfterSeconds(error: AuthError): number | undefined {
  const value = (error as AuthError & { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}

function credentialsErrorState(error: CredentialsSignin): LoginActionState {
  const code = PUBLIC_CREDENTIAL_ERROR_CODES.has(error.code as LoginActionErrorCode)
    ? (error.code as LoginActionErrorCode)
    : 'invalid_credentials';
  const retryAfterSeconds = readRetryAfterSeconds(error);

  return retryAfterSeconds === undefined
    ? { status: 'error', code }
    : { status: 'error', code, retryAfterSeconds };
}

export async function authenticateCredentials(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const credentials = loginSchema.safeParse({
    email: readString(formData, 'email'),
    password: readString(formData, 'password'),
  });

  if (!credentials.success) {
    return { status: 'error', code: 'invalid_credentials' };
  }

  const locale = readLocale(formData);
  const redirectTo = resolveSafeAuthRedirect(readString(formData, 'redirectTo'), locale);

  try {
    await signIn('credentials', {
      ...credentials.data,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return credentialsErrorState(error);
    }
    if (error instanceof AuthError) {
      return { status: 'error', code: 'login_failed' };
    }
    throw error;
  }

  return { status: 'error', code: 'login_failed' };
}

export async function authenticateGoogle(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const redirectTo = resolveSafeAuthRedirect(readString(formData, 'redirectTo'), locale);
  await signIn('google', { redirectTo });
}

export async function logout(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const redirectTo = locale === defaultLocale ? '/' : `/${locale}`;
  await signOut({ redirectTo });
}
