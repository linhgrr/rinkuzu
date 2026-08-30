'use client';

import { type Dispatch, useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SubscriptionPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { HiOutlineCheck, HiOutlineShieldCheck } from 'react-icons/hi';
import type { SubscriptionPlanViewModel } from '@/features/subscription/types/subscription-page-view-model';
import { fetchSubscriptionPageViewModel } from '@/features/subscription/api/subscription-page-api';
import {
  initialSubscriptionPageState,
  subscriptionPageReducer,
  type SubscriptionPageAction,
} from '@/features/subscription/lib/subscription-page-state';
import {
  FREE_PRICING_FEATURE_KEYS,
  PREMIUM_PRICING_FEATURE_KEYS,
} from '@/features/subscription/constants/pricing-features';

async function loadSubscriptionPage(dispatch: Dispatch<SubscriptionPageAction>): Promise<void> {
  dispatch({ type: 'loadStart' });
  try {
    const viewModel = await fetchSubscriptionPageViewModel();
    dispatch({ type: 'loadSuccess', value: viewModel });
  } catch (error) {
    console.error('Error loading subscription data:', error);
    dispatch({ type: 'loadError' });
  }
}

export function SubscriptionPageClient() {
  const t = useTranslations('subscription');
  const tPricing = useTranslations('pricing');
  const router = useRouter();
  const [state, dispatch] = useReducer(subscriptionPageReducer, initialSubscriptionPageState);
  const freeFeatures = FREE_PRICING_FEATURE_KEYS.map((key) => tPricing(`free.features.${key}`));
  const premiumFeatures = PREMIUM_PRICING_FEATURE_KEYS.map((key) =>
    tPricing(`premium.features.${key}`),
  );

  useEffect(() => {
    void loadSubscriptionPage(dispatch);
  }, []);

  const handlePurchase = (plan: SubscriptionPlanViewModel): void => {
    router.push(`/checkout?plan=${encodeURIComponent(plan.id)}`);
  };

  const currentSubscription = state.currentSubscription;
  const hasActivePremium = state.isPremium;

  if (state.status === 'loading') {
    return <SubscriptionPageSkeleton label={t('loading')} />;
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-dvh bg-surface-page pb-24 md:pb-8">
        <div className="py-6 md:py-8">
          <div className="max-w-6xl mx-auto px-4">
            <Card className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold text-ink mb-2">{t('errorTitle')}</h2>
              <p className="text-sm md:text-base text-ink-muted mb-4 md:mb-6">{t('loadError')}</p>
              <Button onClick={() => void loadSubscriptionPage(dispatch)}>{t('retry')}</Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-page pb-24 md:pb-8">
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
                    {currentSubscription.plan.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-accent">{t('expiresOn')}</p>
                  <p
                    className={`font-medium ${hasActivePremium ? 'text-green-800' : 'text-amber-800'}`}
                  >
                    {currentSubscription.endDateLabel}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="mb-6 text-center md:mb-8">
            <h1 className="text-2xl font-semibold text-ink md:text-3xl">{t('upgradeAccount')}</h1>
            <p className="mt-2 text-sm text-ink-muted md:text-base">{t('upgradeDescription')}</p>
          </div>

          {/* Subscription Plans */}
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            <Card className="flex h-full flex-col border-line p-4 md:p-6">
              <div className="mb-4 text-center md:mb-6">
                <h3 className="mb-2 text-xl font-semibold text-ink md:text-2xl">
                  {tPricing('free.name')}
                </h3>
                <div className="mb-2 text-2xl font-bold text-ink md:text-4xl">0 ₫</div>
                <p className="text-sm text-ink-muted md:text-base">{tPricing('free.tagline')}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2 md:mb-8 md:space-y-3">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <HiOutlineCheck className="mr-3 mt-0.5 size-5 flex-shrink-0 text-green-500" />
                    <span className="text-ink">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button disabled className="w-full" variant="outline">
                {hasActivePremium ? t('freePlan') : t('currentPlan')}
              </Button>
            </Card>

            {state.plans.map((plan, index) => (
              <Card
                key={plan.id}
                // Identifies which plan a card belongs to, so an end-to-end run
                // can act on its own seeded plan. Every card renders the same
                // "Subscribe" label, so without this the button is ambiguous
                // the moment the catalogue holds more than one plan.
                data-testid={`plan-card-${plan.id}`}
                className="relative flex h-full flex-col border-brand-action/40 p-4 md:p-6"
              >
                {index === 0 && (
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

                <p className="mb-3 font-medium text-green-700">
                  {tPricing('premium.everythingInFree')}
                </p>
                <ul className="mb-6 flex-1 space-y-2 md:mb-8 md:space-y-3">
                  {premiumFeatures.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <HiOutlineCheck className="size-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-ink">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePurchase(plan)}
                  className="w-full"
                  variant={index === 0 ? 'default' : 'outline'}
                >
                  {hasActivePremium ? t('extend') : t('subscribe')}
                </Button>
                {hasActivePremium && (
                  <p className="mt-2 text-center text-xs leading-5 text-ink-muted">
                    {t('extendNote')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
