'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';
import { describeApiError, KIND_MESSAGE_KEYS, type DescribedApiError } from './error-kind';

type Translate = ReturnType<typeof useTranslations>;
type FormatError = (described: DescribedApiError, t: Translate, fallback?: string) => string;

/**
 * Shared by both hooks: logs kind + code + status only (the payload and server text can hold
 * personal data) and returns '' for aborted requests (render nothing).
 * `format` must be a module-level function so the returned callback stays stable.
 */
function useFormattedApiError(format: FormatError): (error: unknown, fallback?: string) => string {
  const t = useTranslations();
  return useCallback(
    (error: unknown, fallback?: string) => {
      const described = describeApiError(error);
      if (described.kind === 'aborted') return '';
      const { kind, code, status } = described;
      console.warn('[api-error]', { kind, code, status });
      return format(described, t, fallback);
    },
    [format, t],
  );
}

const formatLearnerError: FormatError = (described, t, fallback) => {
  const { kind, code, status } = described;
  if (kind === 'unknown' && code === null && status === null && fallback) return fallback;
  // USER_SAFE_DETAIL_CODES is empty in v1, so server text is never returned here.
  return t(described.messageKey, described.messageValues);
};

/**
 * Localized copy for an API error (RIN-748 contract, section 4).
 * `fallback` (already localized, screen-specific) replaces the generic copy when the error
 * carries no code or status, e.g. a plain `Error` from client code (RIN-754).
 */
export function useApiErrorMessage(): (error: unknown, fallback?: string) => string {
  return useFormattedApiError(formatLearnerError);
}

const GENERIC_MESSAGE_KEYS: ReadonlySet<string> = new Set([
  KIND_MESSAGE_KEYS.server,
  KIND_MESSAGE_KEYS.unknown,
]);

const formatAdminError: FormatError = (described, t, fallback) => {
  const message =
    fallback && GENERIC_MESSAGE_KEYS.has(described.messageKey)
      ? fallback
      : t(described.messageKey, described.messageValues);
  const { code } = described;
  return code ? `${message} · ${t('errors.api.codeLabel', { code })}` : message;
};

/**
 * Admin surfaces (RIN-757): localized copy plus `Code: x` for diagnosis, never the server text.
 * `fallback` is already-localized, task-specific copy ("Could not save the key"); it replaces the
 * generic server/unknown sentence, while code-specific and kind copy (forbidden, rate limit) win.
 */
export function useAdminApiErrorMessage(): (error: unknown, fallback?: string) => string {
  return useFormattedApiError(formatAdminError);
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
