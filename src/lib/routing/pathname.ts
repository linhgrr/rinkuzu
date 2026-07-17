import { defaultLocale, locales } from '@/i18n/config';

type LocalePathInfo = {
  locale: string;
  pathWithoutLocale: string;
};

const EXERCISE_MODE_PREFIXES = ['/adaptive/exercise', '/adaptive/result'];

const FOOTER_PATHS = [
  '/',
  '/about',
  '/pricing',
  '/faq',
  '/blog',
  '/privacy',
  '/terms',
  '/cookies',
  '/contact',
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Shared locale-prefix segment parse for stripLocaleFromPath / getLocaleFromPath.
 * Returns locale only when the first path segment is a supported locale code.
 */
function parseLocalePath(pathname: string): {
  locale: (typeof locales)[number] | null;
  pathWithoutLocale: string;
} {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/');
  const firstSegment = segments[1];

  if (firstSegment !== undefined && locales.includes(firstSegment as (typeof locales)[number])) {
    const restPath = `/${segments.slice(2).join('/')}`;
    return {
      locale: firstSegment as (typeof locales)[number],
      pathWithoutLocale: normalizePath(restPath === '/' ? '/' : restPath),
    };
  }

  return {
    locale: null,
    pathWithoutLocale: normalized,
  };
}

export function stripLocaleFromPath(pathname: string): string {
  return parseLocalePath(pathname).pathWithoutLocale;
}

/**
 * Normalize any internal/app href to the form next-intl expects:
 * locale-unprefixed pathname (+ optional query/hash).
 *
 * Use before `router.push` / `replace` / `Link` when the value may already
 * include `/en` or `/vi` (legacy callbackUrls, browser location, etc.).
 */
export function toIntlHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return href;
  }

  const queryIndex = href.indexOf('?');
  const hashIndex = href.indexOf('#');
  let pathEnd = href.length;
  if (queryIndex >= 0) pathEnd = Math.min(pathEnd, queryIndex);
  if (hashIndex >= 0) pathEnd = Math.min(pathEnd, hashIndex);

  const path = href.slice(0, pathEnd);
  const suffix = href.slice(pathEnd);
  return `${stripLocaleFromPath(path)}${suffix}`;
}

/**
 * Final browser pathname for a given locale (`localePrefix: 'always'`).
 * Prefer this over string-concatenating `/${locale}/...`.
 *
 * Same contract as next-intl `getPathname({ locale, href })`, but pure so it is
 * safe in middleware/edge and unit tests (no `next/navigation` client graph).
 * @see https://next-intl.dev/docs/routing/navigation#getpathname
 */
export function toBrowserPath(pathWithoutLocale: string, locale: string): string {
  const path = normalizePath(
    pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`,
  );

  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

export function getLocaleFromPath(pathname: string): LocalePathInfo {
  const { locale, pathWithoutLocale } = parseLocalePath(pathname);
  return {
    locale: locale ?? defaultLocale,
    pathWithoutLocale,
  };
}

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdaptiveExerciseModePath(pathname: string): boolean {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  return EXERCISE_MODE_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix));
}

export function shouldHideGlobalFooter(pathname: string): boolean {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  const shouldShowFooter = FOOTER_PATHS.some((path) => matchesPrefix(pathWithoutLocale, path));
  return !shouldShowFooter;
}

export type ProductScope = 'adaptive' | 'quiz' | 'hub';

const ADAPTIVE_SCOPE_PREFIXES = ['/adaptive'];
const QUIZ_SCOPE_PREFIXES = [
  '/create',
  '/edit',
  '/draft',
  '/my-quizzes',
  '/review',
  '/history',
  '/bookmarks',
  '/explore',
  '/quizzes',
  '/quiz',
];

/**
 * Returns which product surface a given path belongs to. Used by the
 * mobile bottom nav to swap its tab set when the user is inside a
 * specific product (Quiz Builder vs Adaptive Learning).
 */
export function getProductScope(pathname: string): ProductScope {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  if (ADAPTIVE_SCOPE_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'adaptive';
  }
  if (QUIZ_SCOPE_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))) {
    return 'quiz';
  }
  return 'hub';
}
