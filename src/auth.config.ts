import type { NextAuthConfig } from 'next-auth';

import { defaultLocale } from '@/i18n/config';
import { projectTokenToSession } from '@/lib/auth/session-projection';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';
import { getLocaleFromPath, toBrowserPath } from '@/lib/routing/pathname';

function positiveSeconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function localizedAuthTarget(url: string | null, locale: string): string {
  return resolveAuthCallback(url, locale).browserUrl;
}

function localizedRootTarget(pathname: string, base: URL): string | null {
  const { locale, pathWithoutLocale } = getLocaleFromPath(pathname);
  return pathWithoutLocale === '/'
    ? new URL(toBrowserPath('/', locale || defaultLocale), base).toString()
    : null;
}

export function resolveAuthRedirectTarget(url: string, baseUrl: string): string {
  const base = new URL(baseUrl);

  if (url.startsWith('/') && !url.startsWith('//')) {
    const target = new URL(url, base);
    const rootTarget = localizedRootTarget(target.pathname, base);
    if (rootTarget) return rootTarget;
    const { locale } = getLocaleFromPath(target.pathname);
    return new URL(localizedAuthTarget(url, locale || defaultLocale), base).toString();
  }

  try {
    const target = new URL(url);
    if (target.origin !== base.origin) {
      return new URL(localizedAuthTarget(null, defaultLocale), base).toString();
    }

    const rootTarget = localizedRootTarget(target.pathname, base);
    if (rootTarget) return rootTarget;
    const { locale } = getLocaleFromPath(target.pathname);
    const safeTarget = localizedAuthTarget(
      `${target.pathname}${target.search}${target.hash}`,
      locale || defaultLocale,
    );
    return new URL(safeTarget, base).toString();
  } catch {
    return new URL(localizedAuthTarget(null, defaultLocale), base).toString();
  }
}

/**
 * Edge-safe Auth.js configuration. Proxy imports this module, so it must not
 * pull providers, database clients, Node-only secrets, or server-only modules.
 */
const authConfig = {
  providers: [],
  trustHost: process.env['AUTH_TRUST_HOST'] === 'true',
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
