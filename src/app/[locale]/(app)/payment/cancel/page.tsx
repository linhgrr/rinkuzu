'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function PaymentCancelContent() {
  const t = useTranslations('subscription');
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const { push } = useRouter();
  const orderCode = get('orderCode');

  const handleGoHome = () => {
    push('/');
  };

  const handleGoToSubscription = () => {
    push('/subscription');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-8">
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
          <h1 className="text-2xl font-semibold text-neutral-900 mb-4">
            {t('paymentCancelledTitle')}
          </h1>
          <p className="text-neutral-600 mb-6">
            {t('paymentCancelledMessage')}
            {orderCode && (
              <span className="block text-sm text-neutral-500 mt-2">
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
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
        <p className="mt-4 text-neutral-600">{t('loading')}</p>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<PaymentCancelLoading />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
