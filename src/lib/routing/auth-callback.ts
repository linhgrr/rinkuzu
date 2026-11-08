import { defaultLocale, locales } from '@/i18n/config';
import { stripLocaleFromPath, toBrowserPath, toIntlHref } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';

const BLOCKED_AUTH_CALLBACK_PATHS = new Set<string>([
  '/',
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ...locales.map((locale) => `/${locale}`),
]);

/**
 * Values that name no real destination. The signed-out /dashboard guard and the
 * proxy send `callbackUrl=/dashboard`, so it means "wherever sign-in lands" (RIN-913).
 */
const DEFAULT_AUTH_CALLBACK_PATHS = new Set<string>([ROUTES.DASHBOARD, ROUTES.START]);

export type ResolvedAuthCallback = {
  /** For next-intl `router.push` / `replace` (no locale prefix). */
  intlHref: string;
  /** For NextAuth full-document redirects (locale prefix when needed). */
  browserUrl: string;
};

/**
 * Normalize an auth `callbackUrl` query value into both navigation forms.
 * Accepts either unprefixed (`/review`) or prefixed (`/en/review`) input. With no
 * real destination (absent, unsafe, blocked or `/dashboard`) sign-in lands on
 * ROUTES.START, which picks the starter quiz or the dashboard (RIN-913).
 */
export function resolveAuthCallback(
  raw: string | null | undefined,
  locale: string,
): ResolvedAuthCallback {
  const fallback = ROUTES.START;

  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return {
      intlHref: fallback,
      browserUrl: toBrowserPath(fallback, locale),
    };
  }

  const intlHref = toIntlHref(raw);
  const pathOnly = stripLocaleFromPath(intlHref.split('?')[0] ?? intlHref);
  const safeIntlHref =
    BLOCKED_AUTH_CALLBACK_PATHS.has(pathOnly) || DEFAULT_AUTH_CALLBACK_PATHS.has(pathOnly)
      ? fallback
      : intlHref;
  const [path, query] = safeIntlHref.split('?');
  const browserPath = toBrowserPath(path || fallback, locale);

  return {
    intlHref: safeIntlHref,
    browserUrl: query ? `${browserPath}?${query}` : browserPath,
  };
}

/**
 * The safe, locale-unprefixed callback path worth forwarding to the next auth
 * step (sign-up link, verification email, verify page), or null when the value
 * would fall back to the post-sign-in landing anyway. Same guards as resolveAuthCallback:
 * same-origin paths only, `//` rejected, auth pages and the home page blocked.
 */
export function forwardableAuthCallback(raw: string | null | undefined): string | null {
  const { intlHref } = resolveAuthCallback(raw, defaultLocale);
  return intlHref === ROUTES.START ? null : intlHref;
}

/** `route` with `?callbackUrl=` appended when `raw` is safe to forward. */
export function withAuthCallback(route: string, raw: string | null | undefined): string {
  const callback = forwardableAuthCallback(raw);
  return callback ? `${route}?callbackUrl=${encodeURIComponent(callback)}` : route;
}
