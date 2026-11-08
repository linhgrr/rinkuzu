'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from '@/i18n/navigation';
import { ApiResponseError } from '@/lib/api/client';

/** Why the first quote failed: the plan itself, or a translated error to retry past. */
export type QuoteFailure = { unavailable: true } | { unavailable: false; messageKey: string };

/**
 * A plan id that names no active plan (stale link, typo) gets the same way out
 * as no plan at all. 400 is the body schema rejecting the id itself.
 */
export function isUnavailablePlan(error: unknown): boolean {
  return (
    error instanceof ApiResponseError && (error.code === 'plan_not_found' || error.status === 400)
  );
}

type CheckoutEmptyStateProps = {
  title: string;
  onRetry?: () => void;
};

/** Body state for checkout without a usable plan: always offers the way back to plans. */
export function CheckoutEmptyState({ title, onRetry }: CheckoutEmptyStateProps) {
  const t = useTranslations('checkout');
  const router = useRouter();
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              {t('actions.retry')}
            </Button>
          )}
          <Button onClick={() => router.push('/subscription')}>{t('noPlan.action')}</Button>
        </div>
      </Card>
    </div>
  );
}

type CheckoutQuoteFailureProps = {
  failure: QuoteFailure;
  onRetry: () => void;
};

/** RIN-1015: replaces the empty summary card and vanishing toast of a failed first quote. */
export function CheckoutQuoteFailure({ failure, onRetry }: CheckoutQuoteFailureProps) {
  const t = useTranslations('checkout');
  return failure.unavailable ? (
    <CheckoutEmptyState title={t('noPlan.unavailable')} />
  ) : (
    <CheckoutEmptyState title={t(failure.messageKey)} onRetry={onRetry} />
  );
}
