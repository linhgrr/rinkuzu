import type { NextAuthConfig } from 'next-auth';

import { defaultLocale } from '@/i18n/config';
import { projectTokenToSession } from '@/lib/auth/session-projection';
import { getLocaleFromPath } from '@/lib/routing/pathname';
import { resolveSafeAuthRedirect } from '@/lib/routing/auth-redirect';

function positiveSeconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAuthRedirectTarget(url: string, baseUrl: string): string {
  const base = new URL(baseUrl);
  const fallbackLocale = defaultLocale;

  if (url.startsWith('/')) {
    const { locale } = getLocaleFromPath(url);
    return resolveSafeAuthRedirect(url, locale || fallbackLocale);
  }

  try {
    const target = new URL(url);
    if (target.origin !== base.origin) {
      return resolveSafeAuthRedirect(null, fallbackLocale);
    }
    const { locale } = getLocaleFromPath(target.pathname);
    return resolveSafeAuthRedirect(
      `${target.pathname}${target.search}${target.hash}`,
      locale || fallbackLocale,
    );
  } catch {
    return resolveSafeAuthRedirect(null, fallbackLocale);
  }
}

/**
 * Edge-safe Auth.js config: no Node providers, no DB.
 * Proxy uses this for coarse JWT gates only.
 */
const authConfig = {
  providers: [],
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: positiveSeconds(process.env['SESSION_MAX_AGE_SECONDS'], 28_800),
    updateAge: positiveSeconds(process.env['SESSION_UPDATE_AGE_SECONDS'], 3_600),
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    redirect({ url, baseUrl }) {
      return resolveAuthRedirectTarget(url, baseUrl);
    },
    session({ session, token }) {
      return projectTokenToSession(session, token);
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
