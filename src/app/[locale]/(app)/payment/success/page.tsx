'use client';

import { Suspense, useEffect, useReducer } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PaymentStatusPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { verifySubscriptionPayment } from '@/features/payment/api/payment-verification-api';

type PaymentStatus = 'loading' | 'success' | 'error';

type PaymentViewState = {
  status: PaymentStatus;
  message: string;
};

type PaymentViewAction = {
  type: 'setView';
  value: PaymentViewState;
};

const initialViewState: PaymentViewState = {
  status: 'loading',
  message: '',
};

function paymentViewReducer(_state: PaymentViewState, action: PaymentViewAction): PaymentViewState {
  switch (action.type) {
    case 'setView':
      return action.value;
    default:
      return _state;
  }
}

function PaymentSuccessContent() {
  const t = useTranslations('subscription');
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const { push } = useRouter();
  const [viewState, dispatch] = useReducer(paymentViewReducer, initialViewState);

  useEffect(() => {
    const orderCode = get('orderCode');
    if (!orderCode) {
      dispatch({ type: 'setView', value: { status: 'error', message: t('errorTitle') } });
      return;
    }

    const verifyPayment = async (nextOrderCode: string) => {
      try {
        await verifySubscriptionPayment(nextOrderCode);
        dispatch({
          type: 'setView',
          value: { status: 'success', message: t('paymentSuccessMessage') },
        });
      } catch (error) {
        console.error('Error verifying payment:', error);
        dispatch({
          type: 'setView',
          value: {
            status: 'error',
            message: error instanceof Error ? error.message : t('errorTitle'),
          },
        });
      }
    };

    void verifyPayment(orderCode);
  }, [get, t]);

  const handleGoHome = () => {
    push('/');
  };

  const handleGoToSubscription = () => {
    push('/subscription');
  };

  if (viewState.status === 'loading') {
    return <PaymentStatusPageSkeleton label={t('verifyingPayment')} />;
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center py-8">
      <div className="max-w-md mx-auto px-4">
        <Card className="p-8 text-center">
          {viewState.status === 'success' ? (
            <>
              <div className="size-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="size-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-ink mb-4">{t('paymentSuccessTitle')}</h1>
              <p className="text-ink-muted mb-6">{viewState.message}</p>
              <div className="space-y-3">
                <Button onClick={handleGoHome} className="w-full">
                  {t('backToHome')}
                </Button>
                <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
                  {t('viewPremium')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="size-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="size-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-ink mb-4">{t('errorTitle')}</h1>
              <p className="text-ink-muted mb-6">{viewState.message}</p>
              <div className="space-y-3">
                <Button onClick={handleGoHome} className="w-full">
                  {t('backToHome')}
                </Button>
                <Button onClick={handleGoToSubscription} variant="outline" className="w-full">
                  {t('retryPayment')}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function PaymentSuccessLoading() {
  const t = useTranslations('common');
  return <PaymentStatusPageSkeleton label={t('loading')} />;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
