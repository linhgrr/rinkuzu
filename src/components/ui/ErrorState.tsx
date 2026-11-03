'use client';

import { type MouseEvent, type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { describeApiError } from '@/lib/api/error-kind';
import { buildAuthRequiredHref, useAuthRequiredPrompt } from '@/lib/api/use-api-error';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from './Button';
import {
  resolveErrorStateView,
  type ErrorStateActionKind,
  type ErrorStateVariant,
  type ErrorStateView,
} from './error-state-view';

interface ErrorStateProps {
  /** Any thrown value; copy, tone and CTAs come from `describeApiError` (RIN-748). */
  error?: unknown;
  /** Already-localized text. Wins over the error's body copy when given. */
  message?: string;
  variant?: ErrorStateVariant;
  /** May return a promise: the button shows a spinner until it settles. */
  onRetry?: () => void | Promise<unknown>;
  action?: ReactNode;
  className?: string;
}

/** Legacy `message`-only callers keep today's box until they are migrated to `error`. */
function LegacyErrorState({
  message,
  onRetry,
  action,
  className = '',
}: Omit<ErrorStateProps, 'error' | 'variant'>) {
  const tCommon = useTranslations('common');

  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-error bg-error-surface p-4', className)}
    >
      <p className="font-home text-sm text-error">{message}</p>
      {onRetry ? (
        <Button variant="destructive" size="sm" className="mt-3 font-home" onClick={onRetry}>
          {tCommon('retry')}
        </Button>
      ) : action ? (
        <div className="mt-2">{action}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({ error, message, variant = 'inline', ...rest }: ErrorStateProps) {
  if (error === undefined && message !== undefined) {
    return <LegacyErrorState message={message} {...rest} />;
  }
  return <ApiErrorState error={error} message={message} variant={variant} {...rest} />;
}

const TONE_CONTAINER: Readonly<Record<ErrorStateView['tone'], string>> = {
  error: 'border-error-border bg-error-surface',
  neutral: 'border-line bg-surface-warm',
  info: 'border-line bg-info-surface',
};

const TONE_ICON: Readonly<Record<ErrorStateView['tone'], string>> = {
  error: 'bg-error-surface text-error',
  neutral: 'bg-accent-soft text-accent',
  info: 'bg-surface text-info',
};

/** 44px touch targets on mobile; `sm` density from 640px (spec section 7). */
const INLINE_ACTION = 'w-full sm:w-auto sm:h-9 sm:px-3 sm:text-xs sm:font-medium';
const PAGE_ACTION = 'w-full sm:w-auto';

/** Seconds left on a countdown that restarts whenever the error changes. */
function useCountdown(error: unknown, seconds: number | null): number | null {
  const [state, setState] = useState({ error, remaining: seconds });
  if (state.error !== error) {
    setState({ error, remaining: seconds });
  }
  const remaining = state.error === error ? state.remaining : seconds;

  const counting = remaining !== null && remaining > 0;

  useEffect(() => {
    if (!counting) return undefined;
    const timer = setInterval(() => {
      setState((current) =>
        current.remaining === null || current.remaining <= 0
          ? current
          : { ...current, remaining: current.remaining - 1 },
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [counting, error]);

  return remaining;
}

interface ApiErrorStateProps extends ErrorStateProps {
  variant: ErrorStateVariant;
}

function ApiErrorState({
  error,
  message,
  variant,
  onRetry,
  action,
  className,
}: ApiErrorStateProps) {
  const t = useTranslations();
  const described = describeApiError(error);
  const view = resolveErrorStateView({ described, variant, hasRetry: Boolean(onRetry) });
  const remaining = useCountdown(error, view?.countdownSeconds ?? null);
  const [pending, setPending] = useState(false);
  const refocusAfterRetry = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (variant === 'page') titleRef.current?.focus();
  }, [variant]);

  // After a retry the user started fails again, focus returns to Retry (or the title).
  useEffect(() => {
    if (pending || !refocusAfterRetry.current) return;
    refocusAfterRetry.current = false;
    (primaryRef.current ?? titleRef.current)?.focus();
  }, [pending]);

  if (!view) return null;

  const isPage = variant === 'page';
  const waiting = remaining !== null && remaining > 0;

  const handleRetry = () => {
    if (!onRetry || waiting || pending) return;
    const result = onRetry();
    if (!(result instanceof Promise)) return;
    setPending(true);
    result
      .catch(() => undefined)
      .finally(() => {
        if (!mounted.current) return;
        refocusAfterRetry.current = true;
        setPending(false);
      });
  };

  const actionClass = isPage ? PAGE_ACTION : INLINE_ACTION;
  const title = t(view.titleKey);
  const body = message ?? t(view.bodyKey, view.bodyValues);
  const announceRetryNow = view.countdownSeconds !== null && view.countdownSeconds > 0 && !waiting;

  return (
    <div
      role={view.tone === 'error' ? 'alert' : 'status'}
      aria-busy={pending || undefined}
      className={cn(
        'font-home',
        isPage
          ? 'mx-auto max-w-md px-4 py-10 text-center sm:py-16'
          : cn('flex items-start gap-3 rounded-xl border p-4', TONE_CONTAINER[view.tone]),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          isPage ? 'mx-auto size-16' : 'size-9',
          TONE_ICON[view.tone],
        )}
      >
        <view.Icon size={isPage ? 28 : 18} strokeWidth={2} />
      </span>
      <div className={cn('min-w-0', isPage ? 'mt-4' : 'flex-1')}>
        {isPage ? (
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold text-ink outline-none sm:text-xl"
          >
            {title}
          </h2>
        ) : (
          <p className="text-sm font-semibold text-ink">{title}</p>
        )}
        <p className={cn('break-words text-sm text-ink-muted', isPage ? 'mt-2' : 'mt-1')}>{body}</p>
        {view.code ? (
          <p className="mt-2 text-xs text-ink-muted">
            {t('errors.api.codeLabel', { code: view.code })}
          </p>
        ) : null}
        <ErrorStateActions
          view={view}
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:flex-wrap',
            isPage ? 'mt-6 sm:justify-center sm:gap-3' : 'mt-3',
          )}
          actionClass={actionClass}
          remaining={remaining}
          waiting={waiting}
          pending={pending}
          primaryRef={primaryRef}
          onRetry={handleRetry}
          extra={action}
        />
        {announceRetryNow ? <span className="sr-only">{t('errors.api.retryNow')}</span> : null}
      </div>
    </div>
  );
}

interface ErrorStateActionsProps {
  view: ErrorStateView;
  className: string;
  actionClass: string;
  remaining: number | null;
  waiting: boolean;
  pending: boolean;
  primaryRef: Ref<HTMLButtonElement>;
  onRetry: () => void;
  extra: ReactNode;
}

function ErrorStateActions({ view, extra, className, ...props }: ErrorStateActionsProps) {
  if (!view.primary && !view.secondary && !extra) return null;
  return (
    <div className={className}>
      {view.primary ? <ErrorStateAction kind={view.primary} primary {...props} /> : null}
      {view.secondary ? (
        <ErrorStateAction kind={view.secondary} primary={false} {...props} />
      ) : null}
      {extra}
    </div>
  );
}

interface ErrorStateActionProps extends Omit<
  ErrorStateActionsProps,
  'view' | 'className' | 'extra'
> {
  kind: ErrorStateActionKind;
  primary: boolean;
}

function ErrorStateAction({
  kind,
  primary,
  actionClass,
  remaining,
  waiting,
  pending,
  primaryRef,
  onRetry,
}: ErrorStateActionProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const promptSignIn = useAuthRequiredPrompt();
  const variantClass = primary ? 'btn-primary' : 'btn-ghost';

  if (kind === 'signIn' || kind === 'upgrade' || kind === 'goHome') {
    const href =
      kind === 'signIn'
        ? buildAuthRequiredHref(pathname, locale)
        : kind === 'upgrade'
          ? ROUTES.SUBSCRIPTION
          : ROUTES.HOME;
    // The rendered href has no query string; a plain click keeps it via window.location.
    const onClick =
      kind === 'signIn'
        ? (event: MouseEvent<HTMLAnchorElement>) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            promptSignIn();
          }
        : undefined;
    return (
      <Link href={href} onClick={onClick} className={cn('btn', variantClass, actionClass)}>
        {t(`errors.api.actions.${kind}`)}
      </Link>
    );
  }

  if (kind === 'back') {
    return (
      <Button
        variant={primary ? 'primary' : 'ghost'}
        className={actionClass}
        onClick={() => router.back()}
      >
        {t('common.back')}
      </Button>
    );
  }

  const label = kind === 'reload' ? t('errors.api.actions.reload') : t('common.retry');
  return (
    <Button
      ref={primary ? primaryRef : undefined}
      variant={primary ? 'primary' : 'ghost'}
      className={cn(actionClass, waiting && 'cursor-not-allowed opacity-50')}
      aria-disabled={waiting || undefined}
      loading={pending}
      onClick={onRetry}
    >
      {waiting && remaining !== null ? (
        <>
          <span aria-hidden="true">{t('errors.api.actions.retryIn', { seconds: remaining })}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </Button>
  );
}
