'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { HiOutlineCheck, HiOutlineShieldCheck, HiOutlineSparkles } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fetchSubscriptionPageViewModel } from '@/features/subscription/api/subscription-page-api';
import type { SubscriptionPlanViewModel } from '@/features/subscription/types/subscription-page-view-model';
import { formatVndCurrency } from '@/lib/formatters';

export type UpgradePromptKind = 'quota' | 'feature';

interface UpgradePaywallModalProps {
  isOpen: boolean;
  kind: UpgradePromptKind;
  onClose: (suppressFuture: boolean) => void;
}

type PlansState =
  | { status: 'loading'; plans: []; isPremium: false }
  | { status: 'ready'; plans: SubscriptionPlanViewModel[]; isPremium: boolean }
  | { status: 'error'; plans: []; isPremium: false };

const INITIAL_STATE: PlansState = { status: 'loading', plans: [], isPremium: false };

export function UpgradePaywallModal({ isOpen, kind, onClose }: UpgradePaywallModalProps) {
  const t = useTranslations('premium');
  const tPricing = useTranslations('pricing');
  const router = useRouter();
  const [plansState, setPlansState] = useState<PlansState>(INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState(false);
  const [suppressFuture, setSuppressFuture] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    void fetchSubscriptionPageViewModel()
      .then((viewModel) => {
        if (!active) return;
        const validPlans = viewModel.plans.filter(
          (plan) => plan.price > 0 && plan.calculatedMonths > 0,
        );
        setPlansState({ status: 'ready', plans: validPlans, isPremium: viewModel.isPremium });
      })
      .catch(() => {
        if (active) setPlansState({ status: 'error', plans: [], isPremium: false });
      });

    return () => {
      active = false;
    };
  }, [isOpen, reloadKey]);

  const bestMonthlyPrice = useMemo(() => {
    if (plansState.status !== 'ready' || plansState.plans.length < 2) return null;
    return Math.min(...plansState.plans.map((plan) => plan.price / plan.calculatedMonths));
  }, [plansState]);

  const handlePurchase = (plan: SubscriptionPlanViewModel) => {
    if (submittingPlanId) return;
    setSubmittingPlanId(plan.id);
    setPaymentError(false);
    onClose(suppressFuture);
    router.push(`/checkout?plan=${encodeURIComponent(plan.id)}`);
  };

  const closePaywall = () => onClose(suppressFuture);
  const title = kind === 'quota' ? t('paywall.quotaTitle') : t('paywall.featureTitle');
  const description =
    kind === 'quota' ? t('paywall.quotaDescription') : t('paywall.featureDescription');

  return (
    <Modal
      isOpen={isOpen}
      onClose={closePaywall}
      title={title}
      description={description}
      size="large"
      className="border border-line shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
    >
      <div className="grid gap-5 md:grid-cols-[0.78fr_2.22fr]">
        <section
          aria-label={t('paywall.currentPlan')}
          className="rounded-2xl border border-line bg-neutral-50 p-5"
        >
          <div className="flex items-center gap-2 text-neutral-500">
            <HiOutlineShieldCheck className="size-5" aria-hidden="true" />
            <span className="text-sm font-medium">{t('paywall.currentPlan')}</span>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-neutral-900">{tPricing('free.name')}</h3>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">0 ₫</p>
          <div className="mt-5 space-y-3 text-sm leading-5 text-neutral-600">
            <p>{tPricing('free.features.askRinChan')}</p>
            <p>{tPricing('free.features.pdfQuiz')}</p>
            <p>{tPricing('free.features.adaptivePath')}</p>
          </div>
          <p className="mt-5 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-neutral-500 ring-1 ring-neutral-200">
            {t('paywall.freeResetNote')}
          </p>
        </section>

        <section aria-label={t('paywall.availablePlans')}>
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent-warm bg-surface-warm p-4 text-ink">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-action text-brand-action-text">
              <HiOutlineSparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-semibold text-ink">{t('paywall.premiumHeading')}</h3>
              <p className="mt-1 text-sm leading-5 text-ink-muted">{t('paywall.premiumSummary')}</p>
            </div>
          </div>

          {plansState.status === 'loading' && (
            <div
              className="grid gap-3 sm:grid-cols-2"
              aria-busy="true"
              aria-label={t('paywall.loading')}
            >
              {[0, 1].map((item) => (
                <div key={item} className="h-48 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          )}

          {plansState.status === 'error' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
              <p className="text-sm">{t('paywall.loadError')}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setPlansState(INITIAL_STATE);
                  setReloadKey((value) => value + 1);
                }}
              >
                {t('paywall.retry')}
              </Button>
            </div>
          )}

          {plansState.status === 'ready' && plansState.isPremium && (
            <div className="rounded-2xl border border-line-blue bg-surface-blue p-5 text-ink">
              <h3 className="font-semibold">{t('paywall.alreadyPremiumTitle')}</h3>
              <p className="mt-2 text-sm leading-5 text-ink-muted">
                {t('paywall.alreadyPremiumDescription')}
              </p>
            </div>
          )}

          {plansState.status === 'ready' &&
            !plansState.isPremium &&
            plansState.plans.length === 0 && (
              <div className="rounded-2xl border border-line bg-neutral-50 p-5 text-neutral-700">
                <p className="text-sm">{t('paywall.noPlans')}</p>
              </div>
            )}

          {plansState.status === 'ready' &&
            !plansState.isPremium &&
            plansState.plans.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {plansState.plans.map((plan) => {
                  const monthlyPrice = plan.price / plan.calculatedMonths;
                  const isBestValue =
                    bestMonthlyPrice !== null && Math.abs(monthlyPrice - bestMonthlyPrice) < 0.5;
                  return (
                    <article
                      key={plan.id}
                      className={`relative flex min-h-52 flex-col rounded-2xl border p-5 ${
                        isBestValue
                          ? 'border-accent bg-surface-warm shadow-[0_12px_32px_rgba(239,74,0,0.12)]'
                          : 'border-line bg-white'
                      }`}
                    >
                      {isBestValue && (
                        <span className="mb-3 self-start rounded-full bg-brand-action px-3 py-1 text-xs font-semibold text-brand-action-text">
                          {t('paywall.bestValue')}
                        </span>
                      )}
                      <h4 className="text-lg font-semibold text-neutral-900">{plan.name}</h4>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                        {plan.priceLabel}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">{plan.durationDisplay}</p>
                      <p className="mt-2 text-sm font-medium text-accent">
                        {t('paywall.perMonth', { price: formatVndCurrency(monthlyPrice) })}
                      </p>
                      <Button
                        className="mt-auto w-full"
                        variant={isBestValue ? 'primary' : 'outline'}
                        loading={submittingPlanId === plan.id}
                        disabled={submittingPlanId !== null}
                        onClick={() => handlePurchase(plan)}
                      >
                        {t('paywall.choosePlan', { plan: plan.name })}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}

          {paymentError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {t('paywall.paymentError')}
            </p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              tPricing('premium.features.askRinChan'),
              tPricing('premium.features.pdfQuiz'),
              tPricing('premium.features.adaptivePath'),
              tPricing('premium.features.premiumCatalog'),
            ].map((benefit) => (
              <div key={benefit} className="flex items-start gap-2 text-sm text-neutral-700">
                <HiOutlineCheck
                  className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-line/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2 text-sm leading-5 text-neutral-500">
          <input
            type="checkbox"
            checked={suppressFuture}
            onChange={(event) => setSuppressFuture(event.target.checked)}
            className="mt-0.5 size-4 rounded border-control-border text-emerald-700 focus:ring-emerald-600"
          />
          <span>{t('dontShowAgain')}</span>
        </label>
        <Button variant="ghost" className="shrink-0" onClick={closePaywall}>
          {t('paywall.continueFree')}
        </Button>
      </div>
    </Modal>
  );
}
