'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineLockClosed,
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
import { useRouter } from '@/i18n/navigation';
import { ApiResponseError } from '@/lib/api/client';
import { formatVndCurrency } from '@/lib/formatters';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';

type CheckoutStatusKey =
  | 'status.fulfilled'
  | 'status.fulfillmentReview'
  | 'status.cancelled'
  | 'status.expired'
  | 'status.failed'
  | 'status.attemptReview'
  | 'status.partial'
  | 'status.paidProcessing'
  | 'status.pending';

type CheckoutErrorKey =
  | 'errors.quote'
  | 'errors.loadOrder'
  | 'errors.verify'
  | 'errors.createPayment'
  | 'errors.promoNotApplicable'
  | 'errors.quoteStale'
  | 'errors.paymentPaused'
  | 'errors.perpetual'
  | 'errors.stateConflict';

function statusMessageKey(order: CheckoutOrder): CheckoutStatusKey {
  if (order.fulfillmentStatus === 'fulfilled') return 'status.fulfilled';
  if (order.fulfillmentStatus === 'review') return 'status.fulfillmentReview';
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
    quote_stale: 'errors.quoteStale',
    payment_creation_disabled: 'errors.paymentPaused',
    already_has_perpetual_entitlement: 'errors.perpetual',
    payment_state_conflict: 'errors.stateConflict',
  };
  return error.code ? (keys[error.code] ?? fallback) : fallback;
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
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [promoCode, setPromoCode] = useState('');
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
      .catch((error: unknown) => toast.error(t(errorMessageKey(error, 'errors.quote'))))
      .finally(() => setLoading(false));
  }, [hasProviderCallback, orderId, planId, t]);

  useEffect(() => {
    if (
      !orderId ||
      order?.fulfillmentStatus === 'fulfilled' ||
      ['cancelled', 'expired', 'failed'].includes(order?.attemptCollectionStatus ?? '')
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void getCheckoutOrder(orderId)
        .then(setOrder)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [order?.attemptCollectionStatus, order?.fulfillmentStatus, orderId]);

  const submit = async () => {
    if (!quote || !termsAccepted || submitting) return;
    setSubmitting(true);
    try {
      const created = await createCheckoutOrder(quote.token, idempotencyKey);
      setOrder(created);
      router.replace(`/checkout?order=${encodeURIComponent(created.id)}`);
      if (created.checkoutUrl) {
        window.location.assign(assertTrustedPayosCheckoutUrl(created.checkoutUrl));
      }
    } catch (error) {
      toast.error(t(errorMessageKey(error, 'errors.createPayment')));
      if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) {
        setIdempotencyKey(crypto.randomUUID());
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-ink-muted">{t('loading')}</div>
    );
  }

  if (!planId && !orderId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">{t('noPlan.title')}</h1>
          <Button className="mt-5" onClick={() => router.push('/subscription')}>
            {t('noPlan.action')}
          </Button>
        </Card>
      </div>
    );
  }

  if (order) {
    const checkoutUrl = order.checkoutUrl;
    const attemptStatus = order.attemptCollectionStatus;
    const checkoutCancelled = attemptStatus === 'cancelled';
    const checkoutEnded = ['cancelled', 'expired', 'failed'].includes(attemptStatus ?? '');
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
          <div className="mt-6 flex flex-wrap gap-3">
            {checkoutUrl &&
              attemptStatus === 'pending' &&
              order.fulfillmentStatus !== 'fulfilled' && (
                <Button
                  onClick={() => window.location.assign(assertTrustedPayosCheckoutUrl(checkoutUrl))}
                >
                  {t('actions.continuePayment')}
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
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
            <HiOutlineLockClosed className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{t('header.title')}</h1>
            <p className="text-sm text-ink-muted">{t('header.description')}</p>
          </div>
        </div>
        <fieldset className="mt-8">
          <legend className="text-sm font-semibold text-ink">{t('paymentMethod.title')}</legend>
          <label className="mt-3 flex cursor-default items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4">
            <input
              type="radio"
              name="payment-method"
              value="payos-bank-qr"
              checked
              readOnly
              className="size-4 accent-emerald-600"
            />
            <span className="rounded-lg bg-white p-2 text-emerald-700 shadow-sm">
              <HiOutlineQrcode className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{t('paymentMethod.bankQr')}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {t('paymentMethod.bankQrDescription')}
              </span>
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              {t('paymentMethod.selected')}
            </span>
          </label>
        </fieldset>
        <div className="mt-8">
          <Input
            label={t('promo.label')}
            value={promoCode}
            maxLength={32}
            icon={<HiOutlineTag />}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder={t('promo.placeholder')}
          />
          <Button
            className="mt-3"
            variant="outline"
            disabled={quoteLoading}
            onClick={() => void loadQuote(promoCode.trim() || null)}
          >
            {t('promo.apply')}
          </Button>
        </div>
        <label className="mt-8 flex items-start gap-3 rounded-xl bg-neutral-50 p-4 text-sm text-ink">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>{t('terms')}</span>
        </label>
      </Card>

      <Card className="h-fit p-6">
        <h2 className="text-lg font-semibold text-ink">{t('summary.title')}</h2>
        {quote && (
          <>
            <p className="mt-5 font-medium text-ink">{quote.plan.name}</p>
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
                  <div className="flex justify-between text-lg font-semibold">
                    <span>{t('summary.total')}</span>
                    <span>{formatVndCurrency(quote.quote.finalAmount)}</span>
                  </div>
                </div>
              )}
            </div>
            <Button
              className="mt-6 w-full"
              loading={submitting}
              disabled={!termsAccepted || quoteLoading}
              onClick={() => void submit()}
            >
              {t('summary.pay')}
            </Button>
            <p className="mt-3 text-center text-xs text-ink-muted">{t('summary.provider')}</p>
          </>
        )}
      </Card>
    </div>
  );
}

export default CheckoutContent;
