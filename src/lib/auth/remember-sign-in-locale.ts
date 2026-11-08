import 'server-only';

import { cookies, headers } from 'next/headers';

import type { IAccountLocaleRepository } from '@/interfaces/repositories/IAuthAccountRepository';
import { resolveAccountLocale, type AccountLocaleSources } from '@/lib/auth/account-locale';
import { logger } from '@/lib/logger';

/** Referer and cookies of the current request; none outside a request scope. */
async function requestLocaleSources(): Promise<Omit<AccountLocaleSources, 'explicit'>> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return { referer: headerStore.get('referer'), cookies: cookieStore };
  } catch {
    return {};
  }
}

/**
 * Stores the sign-in request's locale on an account that has none yet: every
 * new Google account, and accounts created before RIN-1263 when they come
 * back. A stored locale is never overwritten. Best effort: a failure is logged
 * and never fails the sign-in.
 */
export async function rememberSignInLocale(
  repository: IAccountLocaleRepository,
  accountId: string,
  explicit?: unknown,
): Promise<void> {
  try {
    const locale = resolveAccountLocale({ explicit, ...(await requestLocaleSources()) });
    if (locale) await repository.rememberLocaleIfMissing(accountId, locale);
  } catch (error) {
    logger.warn({ error }, 'sign-in locale not recorded');
  }
}
