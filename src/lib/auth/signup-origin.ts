import { defaultLocale, type Locale } from '@/i18n/config';
import type { SignupOrigin } from '@/interfaces/repositories/IAuthAccountRepository';

/** Vercel's edge sets the visitor's country here (ISO-3166 alpha-2). */
export const SIGNUP_COUNTRY_HEADER = 'x-vercel-ip-country';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
/** Vercel's "unknown" and "Tor" pseudo-countries. */
const NO_COUNTRY_CODES = new Set(['XX', 'T1']);

/** The edge country header as stored on a new account: a real alpha-2 code, else null. */
export function signupCountryOf(header: string | null | undefined): string | null {
  if (!header || !COUNTRY_CODE_PATTERN.test(header) || NO_COUNTRY_CODES.has(header)) return null;
  return header;
}

/**
 * Where a new account signed up from (RIN-1268): the signup page's locale
 * (`vi` when the request names none) and the edge country. Nothing else (no
 * city, no IP) is kept.
 */
export function toSignupOrigin(
  locale: Locale | null,
  countryHeader: string | null | undefined,
): SignupOrigin {
  return { signupLocale: locale ?? defaultLocale, signupCountry: signupCountryOf(countryHeader) };
}
