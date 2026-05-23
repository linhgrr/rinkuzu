import { defaultLocale, locales } from '@/i18n/config';

type LocalePathInfo = {
  locale: string;
  pathWithoutLocale: string;
};

const EXERCISE_MODE_PREFIXES = ['/adaptive/exercise', '/adaptive/result'];

const NO_FOOTER_PREFIXES = [
  '/adaptive/exercise',
  '/adaptive/result',
  '/adaptive/processing',
  '/quiz',
  '/create',
  '/edit',
  '/admin',
  '/login',
  '/register',
  '/history',
  '/profile',
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function stripLocaleFromPath(pathname: string): string {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/');
  const firstSegment = segments[1];

  if (locales.includes(firstSegment as (typeof locales)[number])) {
    const restPath = `/${segments.slice(2).join('/')}`;
    return normalizePath(restPath === '/' ? '/' : restPath);
  }

  return normalized;
}

export function getLocaleFromPath(pathname: string): LocalePathInfo {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/');
  const firstSegment = segments[1];

  if (locales.includes(firstSegment as (typeof locales)[number])) {
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

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdaptiveExerciseModePath(pathname: string): boolean {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  return EXERCISE_MODE_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix));
}

export function shouldHideGlobalFooter(pathname: string): boolean {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  return NO_FOOTER_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix));
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
  '/quiz',
  '/categories',
  '/category',
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
