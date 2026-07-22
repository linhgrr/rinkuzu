'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Suspense, useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PaymentStatusPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { reconcileSubscriptionPaymentCancellation } from '@/features/payment/api/payment-verification-api';

type PaymentCancelViewState = {
  status: 'loading' | 'cancelled' | 'error';
  message: string;
};

type PaymentCancelViewAction = { type: 'setView'; value: PaymentCancelViewState };

const initialViewState: PaymentCancelViewState = { status: 'loading', message: '' };

function paymentCancelViewReducer(
  state: PaymentCancelViewState,
  action: PaymentCancelViewAction,
): PaymentCancelViewState {
  return action.type === 'setView' ? action.value : state;
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function PaymentCancelContent() {
  const t = useTranslations('subscription');
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const { push } = useRouter();
  const orderCode = get('orderCode');
  const [viewState, dispatch] = useReducer(paymentCancelViewReducer, initialViewState);

  useEffect(() => {
    if (!orderCode) {
      dispatch({
        type: 'setView',
        value: { status: 'error', message: t('paymentCancellationError') },
      });
      return;
    }

    const controller = new AbortController();
    let ignore = false;
    const reconcile = async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const result = await reconcileSubscriptionPaymentCancellation(
            orderCode,
            controller.signal,
          );
          if (ignore) return;
          if (result.status === 'paid') {
            push(`/payment/success?orderCode=${encodeURIComponent(orderCode)}`);
            return;
          }
          if (result.status === 'cancelled' || result.status === 'expired') {
            dispatch({
              type: 'setView',
              value: { status: 'cancelled', message: t('paymentCancelledMessage') },
            });
            return;
          }
          if (result.status === 'failed') break;
          if (attempt < 2) await waitForRetry(500 * (attempt + 1), controller.signal);
        }

        if (!ignore) {
          dispatch({
            type: 'setView',
            value: { status: 'error', message: t('paymentCancellationPending') },
          });
        }
      } catch {
        if (!ignore) {
          dispatch({
            type: 'setView',
            value: { status: 'error', message: t('paymentCancellationError') },
          });
        }
      }
    };

    void reconcile();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [orderCode, push, t]);

  const handleGoHome = () => {
    push('/');
  };

  const handleGoToSubscription = () => {
    push('/subscription');
  };

  if (viewState.status === 'loading') {
    return <PaymentStatusPageSkeleton label={t('confirmingCancellation')} />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-page py-8">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-8 text-center">
          <div className="size-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="size-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-ink mb-4">
            {t(viewState.status === 'cancelled' ? 'paymentCancelledTitle' : 'errorTitle')}
          </h1>
          <p className="text-ink-muted mb-6">
            {viewState.message}
            {orderCode && (
              <span className="block text-sm text-ink-muted mt-2">
                {t('orderCode')}: {orderCode}
              </span>
            )}
          </p>
          <div className="space-y-3">
            <Button onClick={handleGoHome} className="w-full">
              {t('backToHome')}
            </Button>
            <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
              {t('retryPayment')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PaymentCancelLoading() {
  const t = useTranslations('common');
  return <PaymentStatusPageSkeleton label={t('loading')} />;
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<PaymentCancelLoading />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
