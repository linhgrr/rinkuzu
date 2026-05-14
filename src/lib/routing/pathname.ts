import { defaultLocale, locales } from '@/i18n/config';

type LocalePathInfo = {
  locale: string;
  pathWithoutLocale: string;
};

const EXERCISE_MODE_PREFIXES = ['/adaptive-learning/exercise', '/adaptive-learning/result'];

const NO_FOOTER_PREFIXES = [
  '/adaptive-learning/exercise',
  '/adaptive-learning/result',
  '/adaptive-learning/processing',
  '/quiz',
  '/create',
  '/edit',
  '/admin',
  '/login',
  '/register',
  '/setup',
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
