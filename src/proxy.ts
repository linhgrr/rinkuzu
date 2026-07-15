import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { randomUUID } from 'node:crypto';
import { routing } from './i18n/routing';
import { getLocaleFromPath, matchesPrefix, toBrowserPath } from './lib/routing/pathname';
import { AUTH_REQUIRED_PATH_PREFIXES } from './shared/constants/nav';
import { ROUTES } from './shared/constants/routes';

const intlMiddleware = createMiddleware(routing);

// Guest-only login/register redirect is handled in auth layout (session check).
const AUTH_REQUIRED_PREFIXES = AUTH_REQUIRED_PATH_PREFIXES;

const ADMIN_PREFIX = '/admin';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * API paths that legitimately accept cross-origin or server-to-server traffic
 * and therefore must NOT be CSRF-checked. Keep this list small and document
 * each entry — every exemption is a surface that must be hardened separately.
 */
const CSRF_EXEMPT_API_PREFIXES = [
  // NextAuth handles its own CSRF token for credentials flow.
  '/api/auth/',
  // PayOS calls this endpoint server-to-server with HMAC-signed body; CSRF
  // does not apply because there is no browser session.
  '/api/subscription/webhook',
];

function isStateChangingApiRequest(pathname: string, method: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) return false;
  return !CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Same-origin / CSRF guard.
 *
 * Treat a state-changing API request as legitimate when ANY of:
 *   - browser tells us the request is same-origin via `Sec-Fetch-Site`,
 *   - the `Origin` header equals the request host,
 *   - or the `Referer` host equals the request host (older clients).
 *
 * Reject everything else with 403 — this stops classic CSRF where an
 * attacker site auto-submits a form to our API with the user's cookies.
 */
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

  // No browser metadata at all (e.g. server-to-server tools without Origin)
  // — be strict for state-changing API calls.
  return !origin && !referer && !fetchSite ? false : false;
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

export default async function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || randomUUID();

  // Same-origin / CSRF guard for state-changing API requests.
  if (isStateChangingApiRequest(request.nextUrl.pathname, request.method)) {
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
    // For API routes, propagate the request id and skip the i18n middleware.
    return applySecurityHeaders(NextResponse.next(), requestId);
  }

  // Read-only API requests still need a request id but no CSRF check.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.next(), requestId);
  }

  const { locale, pathWithoutLocale } = getLocaleFromPath(request.nextUrl.pathname);
  const isAdminRoute = matchesPrefix(pathWithoutLocale, ADMIN_PREFIX);
  const isAuthRequiredRoute = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    matchesPrefix(pathWithoutLocale, prefix),
  );

  if (isAdminRoute || isAuthRequiredRoute) {
    const token = await getToken({
      req: request,
      ...(process.env['NEXTAUTH_SECRET'] !== undefined
        ? { secret: process.env['NEXTAUTH_SECRET'] }
        : {}),
    });

    if ((isAdminRoute || isAuthRequiredRoute) && !token) {
      const loginUrl = new URL(toBrowserPath(ROUTES.LOGIN, locale), request.url);
      // Canonical callbackUrl is locale-unprefixed (same form as ROUTES / next-intl hrefs).
      loginUrl.searchParams.set('callbackUrl', `${pathWithoutLocale}${request.nextUrl.search}`);
      return applySecurityHeaders(NextResponse.redirect(loginUrl), requestId);
    }

    if (isAdminRoute && token?.role !== 'admin') {
      const homeUrl = new URL(toBrowserPath(ROUTES.HOME, locale), request.url);
      return applySecurityHeaders(NextResponse.redirect(homeUrl), requestId);
    }
  }

  return applySecurityHeaders(intlMiddleware(request), requestId);
}

export const config = {
  // Match all pathnames except for
  // - Static files (images, etc.)
  // - Next.js internals
  // API routes are now matched so the CSRF / same-origin guard applies; the
  // guard early-returns for read-only and exempt API paths.
  matcher: ['/', '/(vi|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
