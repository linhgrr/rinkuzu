import 'server-only';

import { cookies, headers } from 'next/headers';

import type {
  ISignupOriginRepository,
  ISignupSourceRepository,
} from '@/interfaces/repositories/IAuthAccountRepository';
import { FIRST_TOUCH_COOKIE, parseFirstTouch } from '@/lib/attribution/first-touch';
import { resolveAccountLocale } from '@/lib/auth/account-locale';
import { toSignupOrigin } from '@/lib/auth/signup-origin';
import { resolveClientCountry } from '@/lib/client-ip';
import { logger } from '@/lib/logger';

/**
 * Stores a new Google account's signup origin (RIN-1268): the locale of the
 * page the sign-in started from (Auth.js callback-url cookie, then
 * `NEXT_LOCALE`, else `vi`) and the edge country. Call it only when the
 * sign-in created the account; the write also skips any account that already
 * has one. Best effort: a failure is logged and never fails the sign-in.
 */
export async function rememberGoogleSignupOrigin(
  repository: ISignupOriginRepository,
  accountId: string,
): Promise<void> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const locale = resolveAccountLocale({
      referer: headerStore.get('referer'),
      cookies: cookieStore,
    });
    const origin = toSignupOrigin(locale, resolveClientCountry(headerStore));
    await repository.recordSignupOriginIfMissing(accountId, origin);
  } catch (error) {
    logger.warn({ error }, 'signup origin not recorded');
  }
}

/**
 * Stores a new Google account's first touch (RIN-1762) from the `rk_ft` cookie,
 * parsed as untrusted input: an absent or invalid cookie stores nothing. Call
 * it only when the sign-in created the account. Best effort, never throws.
 */
export async function rememberGoogleSignupSource(
  repository: ISignupSourceRepository,
  accountId: string,
): Promise<void> {
  try {
    const cookieStore = await cookies();
    const source = parseFirstTouch(cookieStore.get(FIRST_TOUCH_COOKIE)?.value, new Date());
    if (source) await repository.recordSignupSourceIfMissing(accountId, source);
  } catch (error) {
    logger.warn({ error }, 'signup source not recorded');
  }
}
