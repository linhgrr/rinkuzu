'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CREDIT_WALLET_KEY, fetchCreditWallet } from '@/features/profile/api/credit-wallet-api';
import { unlockPremiumQuiz } from '@/features/quiz/api/premium-quiz-api';
import { PremiumCreditCost } from '@/features/quiz/components/PremiumCreditCost';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { ROUTES } from '@/shared/constants/routes';

type PremiumPreviewResult = NonNullable<AttemptDetailViewModel['premiumPreview']>;
type PreviewCta = 'unlock' | 'upgrade' | 'free_quiz';

interface PremiumPreviewResultCardProps {
  preview: PremiumPreviewResult;
  /** Slug of the Premium quiz, for "Play the full quiz" after an unlock. */
  slug: string;
  /** Questions this attempt covered (the preview size). */
  playableCount: number;
}

const CONTROL_LINK =
  'inline-flex min-h-11 items-center justify-center text-center text-sm font-medium text-brand-trust hover:underline';

/** Properties carry only which button was used (RIN-1722): never a title or a slug. */
function trackCta(cta: PreviewCta) {
  captureAnalyticsEvent('premium_preview_cta_clicked', { cta });
}

/**
 * The next step after a Premium preview (RIN-1725, Designer spec on RIN-1724): unlock the
 * remaining questions with a credit, upgrade, or play a free quiz. The free quiz link never
 * waits for the credit balance, so there is always a way forward.
 */
export function PremiumPreviewResultCard({
  preview,
  slug,
  playableCount,
}: PremiumPreviewResultCardProps) {
  const t = useTranslations('quiz');
  const { data, error: walletError, mutate } = useSWR(CREDIT_WALLET_KEY, fetchCreditWallet);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const total = preview.fullQuestionCount;
  const remaining = Math.max(0, total - playableCount);
  const balance = data?.wallet.balance;
  const balanceLoading = balance === undefined && !walletError;
  // An unknown balance keeps the unlock available: the server still checks it.
  const cannotAfford = balance !== undefined && balance < 1;

  async function unlock() {
    trackCta('unlock');
    setUnlocking(true);
    setUnlockFailed(false);
    try {
      await unlockPremiumQuiz(preview.quizId);
      setUnlocked(true);
    } catch {
      setUnlockFailed(true);
    } finally {
      setUnlocking(false);
      await mutate();
    }
  }

  if (unlocked) {
    return (
      <SurfaceCard className="mx-auto mb-8 w-full max-w-md p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">{t('premiumPreviewUnlockedTitle')}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t('premiumPreviewUnlockedText', { total })}</p>
        <Link
          href={ROUTES.QUIZ.VIEW(routePathSegment(slug))}
          className="btn btn-primary mt-4 w-full"
        >
          {t('premiumPreviewPlayFull')}
        </Link>
      </SurfaceCard>
    );
  }

  const upgradeClass = cannotAfford || remaining === 0 ? 'btn-primary' : 'btn-secondary';
  const upgrade = (
    <Link
      href={ROUTES.SUBSCRIPTION}
      className={`btn ${upgradeClass} w-full${unlocking ? ' pointer-events-none opacity-60' : ''}`}
      aria-disabled={unlocking || undefined}
      onClick={() => trackCta('upgrade')}
    >
      {t('premiumUpgradeLink')}
    </Link>
  );

  const freeQuiz = preview.freeQuiz;
  const freeQuizLink = (
    <Link
      href={freeQuiz ? ROUTES.QUIZ.VIEW(routePathSegment(freeQuiz.slug)) : ROUTES.EXPLORE}
      className={CONTROL_LINK}
      onClick={() => trackCta('free_quiz')}
    >
      {freeQuiz
        ? t('premiumPreviewFreeQuiz', { subject: freeQuiz.title })
        : t('premiumPreviewFreeQuizNoSubject')}
    </Link>
  );

  const unlockButton = (
    <Button
      variant={cannotAfford ? 'secondary' : 'primary'}
      className="w-full"
      disabled={cannotAfford}
      loading={unlocking}
      onClick={() => void unlock()}
    >
      <PremiumCreditCost
        label={
          cannotAfford
            ? t('premiumNotEnoughCredits')
            : t('premiumPreviewUnlockButton', { remaining })
        }
      />
    </Button>
  );

  let balanceLine = null;
  if (balance !== undefined) {
    balanceLine = (
      <p className="text-sm text-ink-muted">{t('premiumCreditBalance', { count: balance })}</p>
    );
  } else if (walletError) {
    balanceLine = (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">{t('premiumPreviewBalanceError')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0 px-2 text-brand-trust"
          onClick={() => void mutate()}
        >
          {t('premiumPreviewRetry')}
        </Button>
      </div>
    );
  }

  let controls;
  if (remaining === 0) {
    controls = upgrade;
  } else if (balanceLoading) {
    controls = (
      <>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </>
    );
  } else if (cannotAfford) {
    controls = (
      <>
        {upgrade}
        <div className="flex flex-col gap-2">
          {unlockButton}
          {balanceLine}
        </div>
      </>
    );
  } else {
    controls = (
      <>
        <div className="flex flex-col gap-2">
          {unlockButton}
          {balanceLine}
        </div>
        {upgrade}
      </>
    );
  }

  return (
    <SurfaceCard className="mx-auto mb-8 w-full max-w-md p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-ink">
        {remaining === 0
          ? t('premiumPreviewAllTitle', { total })
          : t('premiumPreviewResultTitle', { shown: playableCount, total })}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {remaining === 0
          ? t('premiumPreviewAllText')
          : t('premiumPreviewResultText', { remaining })}
      </p>
      {unlockFailed ? (
        <p role="alert" className="mt-4 text-sm text-error">
          {t('premiumUnlockError')}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        {controls}
        {freeQuizLink}
      </div>
    </SurfaceCard>
  );
}
