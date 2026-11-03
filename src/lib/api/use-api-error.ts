'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';
import { describeApiError } from './error-kind';

/**
 * Localized copy for an API error (RIN-748 contract, section 4).
 * Logs kind + code + status only: the payload and server text can hold personal data.
 * Returns '' for aborted requests (render nothing).
 */
export function useApiErrorMessage(): (error: unknown) => string {
  const t = useTranslations();
  return useCallback(
    (error: unknown) => {
      const described = describeApiError(error);
      if (described.kind === 'aborted') return '';
      const { kind, code, status } = described;
      console.warn('[api-error]', { kind, code, status });
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

/**
 * Failed mutation (RIN-755): an expired session goes to sign-in, an abort shows nothing,
 * anything else is a toast with copy from the error layer. Never the server text.
 */
export function useApiErrorToast(): (error: unknown) => void {
  const describeError = useApiErrorMessage();
  const promptSignIn = useAuthRequiredPrompt();
  return useCallback(
    (error: unknown) => {
      if (describeApiError(error).kind === 'auth_required') {
        promptSignIn();
        return;
      }
      const message = describeError(error);
      if (message) toast.error(message);
    },
    [describeError, promptSignIn],
  );
}
