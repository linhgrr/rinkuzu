import 'server-only';

import { cookies, headers } from 'next/headers';

import type { ISignupOriginRepository } from '@/interfaces/repositories/IAuthAccountRepository';
import { resolveAccountLocale } from '@/lib/auth/account-locale';
import { SIGNUP_COUNTRY_HEADER, toSignupOrigin } from '@/lib/auth/signup-origin';
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
    const origin = toSignupOrigin(locale, headerStore.get(SIGNUP_COUNTRY_HEADER));
    await repository.recordSignupOriginIfMissing(accountId, origin);
  } catch (error) {
    logger.warn({ error }, 'signup origin not recorded');
  }
}
