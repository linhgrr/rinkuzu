'use client';

import { Suspense, useEffect, useReducer } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fetchApiData } from '@/lib/api/client';

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
  const { get } = useSearchParams();
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
        await fetchApiData('/api/subscription/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderCode: nextOrderCode }),
        });
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
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
          <p className="mt-4 text-neutral-600">{t('verifyingPayment')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-8">
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
              <h1 className="text-2xl font-semibold text-neutral-900 mb-4">
                {t('paymentSuccessTitle')}
              </h1>
              <p className="text-neutral-600 mb-6">{viewState.message}</p>
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
              <h1 className="text-2xl font-semibold text-neutral-900 mb-4">{t('errorTitle')}</h1>
              <p className="text-neutral-600 mb-6">{viewState.message}</p>
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
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
        <p className="mt-4 text-neutral-600">{t('loading')}</p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
