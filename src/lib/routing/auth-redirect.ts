import { defaultLocale, locales } from '@/i18n/config';
import { getLocaleFromPath, matchesPrefix } from '@/lib/routing/pathname';

const REDIRECT_BASE_URL = 'https://auth-redirect.rinkuzu.invalid';
const BLOCKED_AUTH_PREFIXES = ['/login', '/register', '/api/auth'];

function localizedDashboardPath(locale: string): string {
  return locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
}

export function resolveSafeAuthRedirect(raw: string | null, locale: string): string {
  const supportedLocale = locales.includes(locale as (typeof locales)[number])
    ? locale
    : defaultLocale;
  const fallback = localizedDashboardPath(supportedLocale);

  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  try {
    const parsed = new URL(raw, REDIRECT_BASE_URL);
    if (parsed.origin !== REDIRECT_BASE_URL) return fallback;

    const { pathWithoutLocale } = getLocaleFromPath(parsed.pathname);
    if (
      pathWithoutLocale === '/' ||
      BLOCKED_AUTH_PREFIXES.some((prefix) => matchesPrefix(pathWithoutLocale, prefix))
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
