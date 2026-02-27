import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';
import { defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware(routing);

const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/create',
  '/profile',
  '/review',
  '/categories',
  '/category',
  '/subscription',
  '/history',
  '/draft',
  '/edit',
];

const ADMIN_PREFIX = '/admin';
const GUEST_ONLY_PREFIXES = ['/login', '/register'];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function getLocaleAndPath(pathname: string) {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/');
  const firstSegment = segments[1];

  if (routing.locales.includes(firstSegment as any)) {
    const restPath = `/${segments.slice(2).join('/')}`;
    return {
      locale: firstSegment,
      pathWithoutLocale: normalizePath(restPath === '/' ? '/' : restPath),
    };
  }

  return {
    locale: defaultLocale,
    pathWithoutLocale: normalized,
  };
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function localizePath(pathname: string, locale: string): string {
  if (locale === defaultLocale) {
    return pathname;
  }
  return `/${locale}${pathname}`;
}

export default async function middleware(request: NextRequest) {
  const { locale, pathWithoutLocale } = getLocaleAndPath(request.nextUrl.pathname);
  const isAdminRoute = matchesPrefix(pathWithoutLocale, ADMIN_PREFIX);
  const isAuthRequiredRoute = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    matchesPrefix(pathWithoutLocale, prefix)
  );
  const isGuestOnlyRoute = GUEST_ONLY_PREFIXES.some((prefix) =>
    matchesPrefix(pathWithoutLocale, prefix)
  );

  if (isAdminRoute || isAuthRequiredRoute || isGuestOnlyRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if ((isAdminRoute || isAuthRequiredRoute) && !token) {
      const loginPath = localizePath('/login', locale);
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set(
        'callbackUrl',
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminRoute && token?.role !== 'admin') {
      const homeUrl = new URL(localizePath('/', locale), request.url);
      return NextResponse.redirect(homeUrl);
    }

    if (isGuestOnlyRoute && token) {
      const dashboardUrl = new URL(localizePath('/dashboard', locale), request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (images, etc.)
  // - Next.js internals
  matcher: [
    '/',
    '/(vi|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
