'use client';

import { useEffect, useReducer } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SubscriptionPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { HiOutlineCheck, HiOutlineShieldCheck } from 'react-icons/hi';
import type {
  SubscriptionPageViewModel,
  SubscriptionPlanViewModel,
} from '@/features/subscription/types/subscription-page-view-model';
import {
  createSubscriptionPaymentUrl,
  fetchSubscriptionPageViewModel,
} from '@/features/subscription/api/subscription-page-api';

interface SubscriptionPageState {
  status: 'loading' | 'ready';
  plans: SubscriptionPlanViewModel[];
  currentSubscription: SubscriptionPageViewModel['currentSubscription'];
  isPremium: boolean;
  selectedPlan: SubscriptionPlanViewModel | null;
  paymentLoading: boolean;
}

type SubscriptionPageAction =
  | { type: 'patch'; value: Partial<SubscriptionPageState> }
  | {
      type: 'loadSuccess';
      value: SubscriptionPageViewModel;
    };

const initialState: SubscriptionPageState = {
  status: 'loading',
  plans: [],
  currentSubscription: null,
  isPremium: false,
  selectedPlan: null,
  paymentLoading: false,
};

function subscriptionPageReducer(
  state: SubscriptionPageState,
  action: SubscriptionPageAction,
): SubscriptionPageState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadSuccess':
      return {
        ...state,
        status: 'ready',
        plans: action.value.plans,
        currentSubscription: action.value.currentSubscription,
        isPremium: action.value.isPremium,
      };
    default:
      return state;
  }
}

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const [state, dispatch] = useReducer(subscriptionPageReducer, initialState);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const viewModel = await fetchSubscriptionPageViewModel();
        dispatch({ type: 'loadSuccess', value: viewModel });
      } catch (error) {
        console.error('Error loading subscription data:', error);
        dispatch({ type: 'patch', value: { status: 'ready' } });
      }
    };

    void loadInitialData();
  }, []);

  const handlePurchase = (plan: SubscriptionPlanViewModel): void => {
    dispatch({ type: 'patch', value: { selectedPlan: plan } });
  };

  const confirmPurchase = async () => {
    if (!state.selectedPlan) return;

    dispatch({ type: 'patch', value: { paymentLoading: true } });
    try {
      const paymentUrl = await createSubscriptionPaymentUrl(state.selectedPlan.id);
      window.location.assign(assertTrustedPayosCheckoutUrl(paymentUrl));
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create payment request');
    }
    dispatch({ type: 'patch', value: { paymentLoading: false, selectedPlan: null } });
  };

  const currentSubscription = state.currentSubscription;
  const hasActivePremium = state.isPremium;

  if (state.status === 'loading') {
    return <SubscriptionPageSkeleton label={t('loading')} />;
  }

  return (
    <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
      <div className="py-6 md:py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Current Subscription Status */}
          {currentSubscription && (
            <Card
              className={`mb-6 md:mb-8 p-4 md:p-6 ${
                hasActivePremium ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <h2
                className={`text-lg md:text-xl font-semibold mb-3 md:mb-4 ${
                  hasActivePremium ? 'text-green-800' : 'text-amber-800'
                }`}
              >
                {hasActivePremium ? t('currentPlan') : t('expiredStatus')}{' '}
                <HiOutlineShieldCheck className="inline-block ml-1" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <p className="text-sm text-accent">{t('title')}</p>
                  <p
                    className={`font-medium ${hasActivePremium ? 'text-green-800' : 'text-amber-800'}`}
                  >
                    {currentSubscription.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-accent">{t('expiresOn')}</p>
                  <p
                    className={`font-medium ${hasActivePremium ? 'text-green-800' : 'text-amber-800'}`}
                  >
                    {currentSubscription.isLifetime
                      ? t('lifetime')
                      : currentSubscription.endDateLabel}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Subscription Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {state.plans.map((plan, index) => (
              <Card key={plan.id} className="p-4 md:p-6 relative">
                {index === 1 && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-500 text-white px-3 md:px-4 py-1 rounded-full text-xs md:text-sm font-medium">
                      {t('popular')}
                    </span>
                  </div>
                )}

                <div className="text-center mb-4 md:mb-6">
                  <h3 className="text-xl md:text-2xl font-semibold text-ink mb-2">{plan.name}</h3>
                  <div className="text-2xl md:text-4xl font-bold text-accent mb-2">
                    {plan.priceLabel}
                  </div>
                  <p className="text-sm md:text-base text-ink-muted">{plan.durationDisplay}</p>
                </div>

                <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <HiOutlineCheck className="size-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-ink">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePurchase(plan)}
                  disabled={state.isPremium}
                  className="w-full"
                  variant={index === 1 ? 'default' : 'outline'}
                >
                  {state.isPremium ? t('premiumPlan') : t('subscribe')}
                </Button>
              </Card>
            ))}
          </div>

          <ConfirmModal
            isOpen={!!state.selectedPlan}
            title={t('subscribe')}
            message={
              <div className="space-y-4">
                <p className="text-ink">
                  {state.selectedPlan?.name} - {state.selectedPlan?.priceLabel ?? ''}
                </p>
              </div>
            }
            confirmText={t('subscribe')}
            cancelText={t('cancel')}
            isLoading={state.paymentLoading}
            onCancel={() => dispatch({ type: 'patch', value: { selectedPlan: null } })}
            onConfirm={confirmPurchase}
          />
        </div>
      </div>
    </div>
  );
}
