'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExternalLink,
  HiOutlineQrcode,
  HiOutlineTag,
  HiOutlineXCircle,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  cancelCheckoutOrder,
  createCheckoutOrder,
  getCheckoutOrder,
  requestCheckoutQuote,
  verifyCheckoutOrder,
  type CheckoutOrder,
  type CheckoutQuote,
} from '@/features/billing/api/checkout-api';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiResponseError } from '@/lib/api/client';
import { formatVndCurrency } from '@/lib/formatters';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';
import {
  CheckoutEmptyState,
  CheckoutQuoteFailure,
  isUnavailablePlan,
  type QuoteFailure,
} from './CheckoutEmptyState';

type CheckoutStatusKey =
  | 'status.fulfilled'
  | 'status.fulfillmentReview'
  | 'status.cancelled'
  | 'status.expired'
  | 'status.failed'
  | 'status.attemptReview'
  | 'status.partial'
  | 'status.paidProcessing'
  | 'status.linkExpired'
  | 'status.pending';

/**
 * The attempt's own deadline passes before reconciliation observes it, so the
 * link can be dead while the attempt still reads `pending`. Treated as ended so
 * the page stops offering a payment button that leads nowhere.
 */
function hasExpiredLink(order: CheckoutOrder): boolean {
  return (
    order.attemptCollectionStatus === 'pending' &&
    order.attemptExpiresAt !== undefined &&
    new Date(order.attemptExpiresAt).getTime() <= Date.now()
  );
}

type CheckoutErrorKey =
  | 'errors.quote'
  | 'errors.loadOrder'
  | 'errors.verify'
  | 'errors.createPayment'
  | 'errors.promoNotApplicable'
  | 'errors.promoNotEligibleForPlan'
  | 'errors.quoteStale'
  | 'errors.paymentPaused'
  | 'errors.perpetual'
  | 'errors.stateConflict';

function statusMessageKey(order: CheckoutOrder): CheckoutStatusKey {
  if (order.fulfillmentStatus === 'fulfilled') return 'status.fulfilled';
  if (order.fulfillmentStatus === 'review') return 'status.fulfillmentReview';
  if (order.collectionStatus === 'unpaid' && hasExpiredLink(order)) return 'status.linkExpired';
  if (order.attemptCollectionStatus === 'cancelled') return 'status.cancelled';
  if (order.attemptCollectionStatus === 'expired') return 'status.expired';
  if (order.attemptCollectionStatus === 'failed') return 'status.failed';
  if (order.attemptCollectionStatus === 'review') return 'status.attemptReview';
  if (order.collectionStatus === 'partial') return 'status.partial';
  if (order.collectionStatus === 'paid') return 'status.paidProcessing';
  return 'status.pending';
}

function errorMessageKey(error: unknown, fallback: CheckoutErrorKey): CheckoutErrorKey {
  if (!(error instanceof ApiResponseError)) return fallback;
  const keys: Record<string, CheckoutErrorKey> = {
    promo_not_applicable: 'errors.promoNotApplicable',
    promo_not_eligible_for_plan: 'errors.promoNotEligibleForPlan',
    quote_stale: 'errors.quoteStale',
    payment_creation_disabled: 'errors.paymentPaused',
    already_has_perpetual_entitlement: 'errors.perpetual',
    payment_state_conflict: 'errors.stateConflict',
  };
  return error.code ? (keys[error.code] ?? fallback) : fallback;
}

function quoteFailureFor(error: unknown): QuoteFailure {
  return isUnavailablePlan(error)
    ? { unavailable: true }
    : { unavailable: false, messageKey: errorMessageKey(error, 'errors.quote') };
}

type CheckoutClientProps = {
  planId: string | null;
  orderId: string | null;
  hasProviderCallback: boolean;
};

function CheckoutContent({ planId, orderId, hasProviderCallback }: CheckoutClientProps) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteFailure, setQuoteFailure] = useState<QuoteFailure | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(Boolean(planId || orderId));
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderAction, setOrderAction] = useState<'idle' | 'verify' | 'cancel'>('idle');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const callbackVerificationOrderId = useRef<string | null>(null);

  const loadQuote = async (code: string | null) => {
    if (!planId || quoteLoading) return;
    setQuoteLoading(true);
    try {
      setQuote(await requestCheckoutQuote(planId, code));
    } catch (error) {
      toast.error(t(errorMessageKey(error, 'errors.quote')));
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      const returnedFromProvider =
        hasProviderCallback && callbackVerificationOrderId.current !== orderId;
      if (returnedFromProvider) callbackVerificationOrderId.current = orderId;
      const request = returnedFromProvider
        ? verifyCheckoutOrder(orderId).catch(async (error: unknown) => {
            toast.error(t(errorMessageKey(error, 'errors.verify')));
            return getCheckoutOrder(orderId);
          })
        : getCheckoutOrder(orderId);
      void request
        .then(setOrder)
        .catch((error: unknown) => toast.error(t(errorMessageKey(error, 'errors.loadOrder'))))
        .finally(() => setLoading(false));
      return;
    }
    if (!planId) return;
    void requestCheckoutQuote(planId, null)
      .then(setQuote)
      .catch((error: unknown) => setQuoteFailure(quoteFailureFor(error)))
      .finally(() => setLoading(false));
  }, [hasProviderCallback, orderId, planId, quoteAttempt, t]);

  const linkExpired =
    order !== null && order.collectionStatus === 'unpaid' && hasExpiredLink(order);

  useEffect(() => {
    // Nothing changes on its own once the link is dead or the attempt closed.
    if (
      !orderId ||
      order?.fulfillmentStatus === 'fulfilled' ||
      ['cancelled', 'expired', 'failed'].includes(order?.attemptCollectionStatus ?? '') ||
      linkExpired
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void getCheckoutOrder(orderId)
        .then(setOrder)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [linkExpired, order?.attemptCollectionStatus, order?.fulfillmentStatus, orderId]);

  const submit = async () => {
    if (!quote || !termsAccepted || submitting) return;
    setSubmitting(true);
    // Every exit clears `submitting` — including a rejected checkout URL — or the
    // pay button stays stuck mid-spin. A provider redirect needs no pending state:
    // `setOrder` has already replaced the pay form with the order view.
    try {
      const created = await createCheckoutOrder(quote.token, idempotencyKey);
      setOrder(created);
      if (created.checkoutUrl) {
        const target = assertTrustedPayosCheckoutUrl(created.checkoutUrl);
        window.location.assign(target);
        return;
      }
      router.replace(`/checkout?order=${encodeURIComponent(created.id)}`);
    } catch (error) {
      toast.error(t(errorMessageKey(error, 'errors.createPayment')));
      if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) {
        setIdempotencyKey(crypto.randomUUID());
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-ink-muted">{t('loading')}</div>
    );
  }

  if (!planId && !orderId) {
    return <CheckoutEmptyState title={t('noPlan.title')} />;
  }

  if (quoteFailure) {
    return (
      <CheckoutQuoteFailure
        failure={quoteFailure}
        onRetry={() => {
          setLoading(true);
          setQuoteFailure(null);
          setQuoteAttempt((value) => value + 1);
        }}
      />
    );
  }

  if (order) {
    const checkoutUrl = order.checkoutUrl;
    const attemptStatus = order.attemptCollectionStatus;
    const checkoutCancelled = attemptStatus === 'cancelled';
    const checkoutEnded =
      ['cancelled', 'expired', 'failed'].includes(attemptStatus ?? '') || linkExpired;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="p-6 md:p-8">
          {order.fulfillmentStatus === 'fulfilled' ? (
            <HiOutlineCheckCircle className="size-11 text-emerald-600" />
          ) : checkoutEnded ? (
            <HiOutlineXCircle className="size-11 text-red-500" />
          ) : (
            <HiOutlineClock className="size-11 text-amber-500" />
          )}
          <h1 className="mt-4 text-2xl font-semibold text-ink">{t(statusMessageKey(order))}</h1>
          <p className="mt-2 text-ink-muted">
            {order.plan.name} · {formatVndCurrency(order.finalAmount)}
          </p>
          {checkoutCancelled && (
            <p className="mt-3 text-sm text-ink-muted">{t('status.cancelledDescription')}</p>
          )}
          {linkExpired && (
            <p className="mt-3 text-sm text-ink-muted">{t('status.linkExpiredDescription')}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {checkoutUrl &&
              attemptStatus === 'pending' &&
              order.fulfillmentStatus !== 'fulfilled' && (
                <Button
                  onClick={() => window.location.assign(assertTrustedPayosCheckoutUrl(checkoutUrl))}
                >
                  {t('actions.continuePayment', {
                    amount: formatVndCurrency(order.finalAmount),
                  })}
                </Button>
              )}
            <Button
              variant="outline"
              loading={orderAction === 'verify'}
              disabled={orderAction !== 'idle'}
              onClick={() => {
                setOrderAction('verify');
                void verifyCheckoutOrder(order.id)
                  .then(setOrder)
                  .catch((error: unknown) =>
                    toast.error(t(errorMessageKey(error, 'errors.verify'))),
                  )
                  .finally(() => setOrderAction('idle'));
              }}
            >
              {t('actions.verify')}
            </Button>
            {attemptStatus === 'pending' && (
              <Button
                variant="ghost"
                loading={orderAction === 'cancel'}
                disabled={orderAction !== 'idle'}
                onClick={() => {
                  setOrderAction('cancel');
                  void cancelCheckoutOrder(order.id)
                    .then(setOrder)
                    .catch((error: unknown) =>
                      toast.error(t(errorMessageKey(error, 'errors.stateConflict'))),
                    )
                    .finally(() => setOrderAction('idle'));
                }}
              >
                {t('actions.cancel')}
              </Button>
            )}
            {checkoutEnded && (
              <Button variant="outline" onClick={() => router.push('/subscription')}>
                {t('actions.choosePlan')}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
      <section className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{t('header.title')}</h1>

        <fieldset className="mt-8">
          <legend className="text-sm font-semibold text-ink">{t('paymentMethod.title')}</legend>
          <div className="mt-3 flex items-center gap-3 border-y border-line py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
              <HiOutlineQrcode className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{t('paymentMethod.bankQr')}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {t('paymentMethod.bankQrDescription')}
              </span>
            </span>
          </div>
        </fieldset>

        <div className="mt-8">
          {promoOpen ? (
            <div className="sm:flex sm:items-end sm:gap-3">
              <Input
                label={t('promo.label')}
                value={promoCode}
                maxLength={32}
                icon={<HiOutlineTag />}
                onChange={(event) => setPromoCode(event.target.value)}
                placeholder={t('promo.placeholder')}
              />
              <Button
                className="mt-3 shrink-0 sm:mt-0"
                variant="outline"
                loading={quoteLoading}
                disabled={quoteLoading}
                onClick={() => void loadQuote(promoCode.trim() || null)}
              >
                {t('promo.apply')}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPromoOpen(true)}
              className="flex min-h-11 items-center gap-2 rounded-lg font-semibold text-ink underline decoration-line-blue underline-offset-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <HiOutlineTag className="size-5" aria-hidden="true" />
              {t('promo.prompt')}
            </button>
          )}
        </div>

        <div className="mt-8 flex items-start gap-3 border-t border-line pt-5 text-sm leading-6 text-ink">
          <input
            id="checkout-terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            aria-labelledby="checkout-terms-copy"
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand-trust)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          />
          <p id="checkout-terms-copy">
            {t('terms.prefix')}{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {t('terms.service')}
            </Link>{' '}
            {t('terms.and')}{' '}
            <Link
              href="/terms#billing-and-refunds"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {t('terms.refund')}
            </Link>
            {t('terms.oneTime')}
          </p>
        </div>
      </section>

      <Card className="h-fit p-6 lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold text-ink">{t('summary.title')}</h2>
        {quote && (
          <>
            <div className="mt-5">
              <p className="font-semibold text-ink">{quote.plan.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {quote.quote.durationUnit === 'month'
                  ? t('summary.monthDuration', { count: quote.quote.durationValue })
                  : t('summary.dayDuration', { count: quote.quote.durationValue })}
              </p>
              <p className="mt-1 text-sm font-medium text-ink">{t('summary.oneTime')}</p>
            </div>
            <div
              className="mt-5 min-h-28 border-t border-neutral-200 pt-5 text-sm"
              aria-busy={quoteLoading}
              aria-live="polite"
            >
              {quoteLoading ? (
                <div className="flex min-h-20 items-center justify-center gap-2 text-ink-muted">
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600"
                    aria-hidden="true"
                  />
                  <span>{t('summary.updating')}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t('summary.basePrice')}</span>
                    <span>{formatVndCurrency(quote.quote.baseAmount)}</span>
                  </div>
                  {quote.quote.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>{t('summary.discount')}</span>
                      <span>−{formatVndCurrency(quote.quote.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-line pt-4 text-lg font-semibold">
                    <span>{t('summary.dueToday')}</span>
                    <span>{formatVndCurrency(quote.quote.finalAmount)}</span>
                  </div>
                </div>
              )}
            </div>
            <Button
              className="mt-6 w-full"
              loading={submitting}
              disabled={!termsAccepted || quoteLoading}
              aria-label={
                submitting
                  ? t('summary.openingProvider')
                  : t('summary.pay', {
                      amount: formatVndCurrency(quote.quote.finalAmount),
                    })
              }
              onClick={() => void submit()}
            >
              {t('summary.pay', { amount: formatVndCurrency(quote.quote.finalAmount) })}
            </Button>
            <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-ink-muted">
              <HiOutlineExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t('summary.provider')}</span>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

export default CheckoutContent;
