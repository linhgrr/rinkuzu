import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import type { NextAuthRequest } from 'next-auth';
import { randomUUID } from 'node:crypto';

import authConfig from './auth.config';
import { routing } from './i18n/routing';
import { defaultLocale } from './i18n/config';
import { getLocaleFromPath } from './lib/routing/pathname';
import { getAuthRoutePolicy } from './lib/routing/auth-route-policy';

const intlMiddleware = createMiddleware(routing);

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * API paths that legitimately accept cross-origin or server-to-server traffic
 * and therefore must NOT be CSRF-checked.
 */
const CSRF_EXEMPT_API_PREFIXES = [
  // Auth.js owns CSRF for its own endpoints.
  '/api/auth/',
  // PayOS server-to-server webhook (HMAC body).
  '/api/subscription/webhook',
];

function isStateChangingApiRequest(pathname: string, method: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) return false;
  return !CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSameOrigin(request: NextRequest): boolean {
  const host = request.headers.get('host');

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
    return true;
  }

  const origin = request.headers.get('origin');
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch {
      /* fall through */
    }
  }

  const referer = request.headers.get('referer');
  if (referer && host) {
    try {
      if (new URL(referer).host === host) return true;
    } catch {
      /* fall through */
    }
  }

  return false;
}

function localizePath(pathname: string, locale: string): string {
  return locale === defaultLocale ? pathname : `/${locale}${pathname}`;
}

function applySecurityHeaders<T extends Response>(response: T, requestId: string): T {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Request-Id', requestId);
  return response;
}

const { auth: withEdgeAuth } = NextAuth(authConfig);

/**
 * Coarse JWT gate for protected/admin routes only.
 * Two-arg signature selects the NextAuth middleware overload (not App Route).
 */
const guardedProxy = withEdgeAuth((request: NextAuthRequest, _event: NextFetchEvent) => {
  const requestId = request.headers.get('x-request-id') || randomUUID();
  const { locale, pathWithoutLocale } = getLocaleFromPath(request.nextUrl.pathname);
  const policy = getAuthRoutePolicy(pathWithoutLocale);

  if (!request.auth?.user) {
    const loginUrl = new URL(localizePath('/login', locale), request.url);
    loginUrl.searchParams.set(
      'callbackUrl',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return applySecurityHeaders(NextResponse.redirect(loginUrl), requestId);
  }

  if (policy === 'admin' && request.auth.user.role !== 'admin') {
    const homeUrl = new URL(localizePath('/', locale), request.url);
    return applySecurityHeaders(NextResponse.redirect(homeUrl), requestId);
  }

  return applySecurityHeaders(intlMiddleware(request), requestId);
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  if (isStateChangingApiRequest(pathname, request.method)) {
    const requestId = request.headers.get('x-request-id') || randomUUID();
    if (!isSameOrigin(request)) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: {
              code: 'forbidden',
              message: 'Cross-origin request blocked',
            },
          },
          { status: 403 },
        ),
        requestId,
      );
    }
    return applySecurityHeaders(NextResponse.next(), requestId);
  }

  if (pathname.startsWith('/api/')) {
    const requestId = request.headers.get('x-request-id') || randomUUID();
    return applySecurityHeaders(NextResponse.next(), requestId);
  }

  const { pathWithoutLocale } = getLocaleFromPath(pathname);
  if (getAuthRoutePolicy(pathWithoutLocale) !== 'public') {
    return guardedProxy(request, event);
  }

  const requestId = request.headers.get('x-request-id') || randomUUID();
  return applySecurityHeaders(intlMiddleware(request), requestId);
}

export const config = {
  matcher: ['/', '/(vi|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
