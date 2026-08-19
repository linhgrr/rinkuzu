import { NextResponse } from 'next/server';

import { signOut } from '@/auth';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { apiErr } from '@/lib/api/response';
import { toBrowserPath } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return typeof value === 'string' && locales.includes(value as Locale)
    ? (value as Locale)
    : defaultLocale;
}

function logoutRedirectTarget(formData: FormData, locale: Locale): string {
  return formData.get('reason') === 'session_replaced'
    ? `${toBrowserPath(ROUTES.LOGIN, locale)}?reason=session_replaced`
    : toBrowserPath(ROUTES.HOME, locale);
}

type AuthSignOutCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type AuthSignOutResult = {
  cookies?: AuthSignOutCookie[];
  redirect?: string;
};

const AUTH_SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

function isSignOutCookie(value: unknown): value is AuthSignOutCookie {
  if (!value || typeof value !== 'object') return false;
  const cookie = value as Partial<AuthSignOutCookie>;
  return (
    typeof cookie.name === 'string' &&
    typeof cookie.value === 'string' &&
    (cookie.options === undefined ||
      (typeof cookie.options === 'object' && cookie.options !== null))
  );
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const locale = readLocale(formData);
  const redirectTo = logoutRedirectTarget(formData, locale);
  const result = (await signOut({ redirect: false, redirectTo })) as AuthSignOutResult;
  const cookies = Array.isArray(result.cookies) ? result.cookies.filter(isSignOutCookie) : [];

  if (!cookies.some((cookie) => AUTH_SESSION_COOKIE.test(cookie.name) && cookie.value === '')) {
    return apiErr('internal_error', 'Session was not cleared', 500);
  }

  const destination = new URL(
    typeof result.redirect === 'string' ? result.redirect : redirectTo,
    request.url,
  );
  if (destination.origin !== new URL(request.url).origin) {
    destination.href = new URL(redirectTo, request.url).href;
  }

  // Materialise cookie headers on a detached response, then copy the serialized
  // headers onto the redirect response. This avoids relying on the mutable
  // `cookies()` request store, which can be dropped when a route handler is
  // composed with middleware in the production server.
  const cookieResponse = new NextResponse(null);
  for (const cookie of cookies) {
    cookieResponse.cookies.set({
      ...cookie.options,
      name: cookie.name,
      value: cookie.value,
    });
  }

  const headers = new Headers({ Location: destination.toString() });
  for (const value of cookieResponse.headers.getSetCookie()) {
    headers.append('Set-Cookie', value);
  }
  return new Response(null, { status: 303, headers });
}
