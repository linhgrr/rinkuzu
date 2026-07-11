import { locales } from '@/i18n/config';
import { stripLocaleFromPath, toBrowserPath, toIntlHref } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';

const BLOCKED_AUTH_CALLBACK_PATHS = new Set<string>([
  '/',
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ...locales.map((locale) => `/${locale}`),
]);

export type ResolvedAuthCallback = {
  /** For next-intl `router.push` / `replace` (no locale prefix). */
  intlHref: string;
  /** For NextAuth full-document redirects (locale prefix when needed). */
  browserUrl: string;
};

/**
 * Normalize an auth `callbackUrl` query value into both navigation forms.
 * Accepts either unprefixed (`/dashboard`) or prefixed (`/en/dashboard`) input.
 */
export function resolveAuthCallback(
  raw: string | null | undefined,
  locale: string,
): ResolvedAuthCallback {
  const fallback = ROUTES.DASHBOARD;

  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return {
      intlHref: fallback,
      browserUrl: toBrowserPath(fallback, locale),
    };
  }

  const intlHref = toIntlHref(raw);
  const pathOnly = stripLocaleFromPath(intlHref.split('?')[0] ?? intlHref);
  const safeIntlHref = BLOCKED_AUTH_CALLBACK_PATHS.has(pathOnly) ? fallback : intlHref;
  const [path, query] = safeIntlHref.split('?');
  const browserPath = toBrowserPath(path || fallback, locale);

  return {
    intlHref: safeIntlHref,
    browserUrl: query ? `${browserPath}?${query}` : browserPath,
  };
}
