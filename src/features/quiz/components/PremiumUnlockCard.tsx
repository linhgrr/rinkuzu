'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CREDIT_WALLET_KEY, fetchCreditWallet } from '@/features/profile/api/credit-wallet-api';
import { PremiumCreditCost } from '@/features/quiz/components/PremiumCreditCost';
import { ROUTES } from '@/shared/constants/routes';

interface PremiumUnlockCardProps {
  title: string;
  description: string;
  loading: boolean;
  error: string;
  /** Unlocks and restarts the player; reports its own failures through `error`. */
  onUnlock: () => Promise<void>;
}

/**
 * The locked state of a Premium quiz or deck (RIN-1014): the credit unlock with a
 * visible label and the learner's balance, the Premium upgrade as the primary action
 * when they cannot afford it, and a way back to the catalog. It shares the header
 * pill's SWR key, so refreshing after an unlock updates both.
 */
export function PremiumUnlockCard({
  title,
  description,
  loading,
  error,
  onUnlock,
}: PremiumUnlockCardProps) {
  const t = useTranslations('quiz');
  const { mutate } = useSWRConfig();
  const { data } = useSWR(CREDIT_WALLET_KEY, fetchCreditWallet);
  const balance = data?.wallet.balance;
  // An unknown balance keeps the unlock available: the server still checks it.
  const cannotAfford = balance !== undefined && balance < 1;

  async function unlock() {
    await onUnlock();
    await mutate(CREDIT_WALLET_KEY);
  }

  const upgradeLink = (
    <Link
      href={ROUTES.SUBSCRIPTION}
      className={
        cannotAfford ? 'btn btn-primary' : 'text-sm font-medium text-brand-trust hover:underline'
      }
    >
      {t('premiumUpgradeLink')}
    </Link>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <Link
        href={ROUTES.PREMIUM_QUIZZES}
        className="text-sm font-medium text-ink-muted hover:text-brand-trust hover:underline"
      >
        <span aria-hidden="true">← </span>
        {t('premiumBackToCatalog')}
      </Link>
      <SurfaceCard className="mt-4 p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-5 rounded-xl bg-brand-trust/5 p-4 text-sm text-ink">{description}</p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col items-center gap-3">
          {cannotAfford ? upgradeLink : null}
          <Button
            variant={cannotAfford ? 'secondary' : 'primary'}
            disabled={cannotAfford}
            loading={loading}
            onClick={() => void unlock()}
          >
            <PremiumCreditCost
              label={cannotAfford ? t('premiumNotEnoughCredits') : t('premiumUnlockButton')}
            />
          </Button>
          {balance === undefined ? null : (
            <p className="text-sm text-ink-muted">
              {t('premiumCreditBalance', { count: balance })}
            </p>
          )}
          {cannotAfford ? null : upgradeLink}
        </div>
      </SurfaceCard>
    </div>
  );
}
