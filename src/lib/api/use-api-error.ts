'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';
import { describeApiError } from './error-kind';

/**
 * Localized copy for an API error (RIN-748 contract, section 4).
 * Logs kind + code + status only: the payload and server text can hold personal data.
 * Returns '' for aborted requests (render nothing).
 * `fallback` (already localized, screen-specific) replaces the generic copy when the error
 * carries no code or status, e.g. a plain `Error` from client code (RIN-754).
 */
export function useApiErrorMessage(): (error: unknown, fallback?: string) => string {
  const t = useTranslations();
  return useCallback(
    (error: unknown, fallback?: string) => {
      const described = describeApiError(error);
      if (described.kind === 'aborted') return '';
      const { kind, code, status } = described;
      console.warn('[api-error]', { kind, code, status });
      if (kind === 'unknown' && code === null && status === null && fallback) return fallback;
      // USER_SAFE_DETAIL_CODES is empty in v1, so server text is never returned here.
      return t(described.messageKey, described.messageValues);
    },
    [t],
  );
}

/** Sign-in path that returns the user to the current page (same-origin, locale-aware). */
export function buildAuthRequiredHref(currentPathWithSearch: string, locale: string): string {
  const { intlHref } = resolveAuthCallback(currentPathWithSearch, locale);
  return `${ROUTES.LOGIN}?callbackUrl=${encodeURIComponent(intlHref)}`;
}

/** The one place where a 401 turns into sign-in. */
export function useAuthRequiredPrompt(): () => void {
  const router = useRouter();
  const locale = useLocale();
  return useCallback(() => {
    const { pathname, search } = window.location;
    router.push(buildAuthRequiredHref(`${pathname}${search}`, locale));
  }, [router, locale]);
}
