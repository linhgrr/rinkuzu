import { locales, type Locale } from '@/i18n/config';

/**
 * The UI locale an account signed up or last signed in from (RIN-1263). Emails
 * sent without a page context (the activation nudge) read it from `User.locale`.
 */

/** next-intl's locale cookie; set only when it differs from Accept-Language. */
const LOCALE_COOKIE = 'NEXT_LOCALE';
/** Auth.js keeps the sign-in `callbackUrl` (`/en/...`) here across the OAuth round trip. */
const AUTH_CALLBACK_COOKIES = ['__Secure-authjs.callback-url', 'authjs.callback-url'] as const;

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface AccountLocaleSources {
  /** A locale the page sent with the form (signup body, credentials field). */
  explicit?: unknown;
  /** Same-origin Referer: the `/[locale]/...` page that posted the form. */
  referer?: string | null;
  cookies?: CookieReader;
}

function toAccountLocale(value: unknown): Locale | null {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

/** `'/en/quiz/x'` or `'https://host/en'` → `'en'`; anything without a locale prefix → null. */
function localeOfUrl(value: string | null | undefined): Locale | null {
  if (!value) return null;
  try {
    return toAccountLocale(new URL(value, 'http://localhost').pathname.split('/')[1]);
  } catch {
    return null;
  }
}

/**
 * First known locale of the request: what the page sent, then the page it was
 * sent from, then the sign-in callback URL, then next-intl's cookie. Null when
 * none says; the email falls back to `vi` itself.
 */
export function resolveAccountLocale(sources: AccountLocaleSources): Locale | null {
  const fromCookies = (): Locale | null => {
    const jar = sources.cookies;
    if (!jar) return null;
    for (const name of AUTH_CALLBACK_COOKIES) {
      const locale = localeOfUrl(jar.get(name)?.value);
      if (locale) return locale;
    }
    return toAccountLocale(jar.get(LOCALE_COOKIE)?.value);
  };
  return toAccountLocale(sources.explicit) ?? localeOfUrl(sources.referer) ?? fromCookies();
}
