'use client';

import { useState, type ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CREDIT_WALLET_KEY, fetchCreditWallet } from '@/features/profile/api/credit-wallet-api';
import { unlockPremiumQuiz } from '@/features/quiz/api/premium-quiz-api';
import { PremiumCreditCost } from '@/features/quiz/components/PremiumCreditCost';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';

type PreviewCta = 'unlock' | 'upgrade' | 'free_quiz';
type UnlockPhase = 'idle' | 'unlocking' | 'failed' | 'unlocked';

interface PremiumPreviewResultCardProps {
  /** Slug of the Premium quiz, for the "play the full quiz" link after an unlock. */
  slug: string;
  /** Questions the learner played in this attempt. */
  playedCount: number;
  fullQuestionCount: number;
  quizId: string;
  freeQuiz: { slug: string; title: string } | null;
}

const LINK_CLASS =
  'inline-flex min-h-11 items-center justify-center text-center text-sm font-medium text-brand-trust hover:underline';

function trackCta(cta: PreviewCta) {
  captureAnalyticsEvent('premium_preview_cta_clicked', { cta });
}

/**
 * Under the score of a Premium preview (RIN-1722, Designer spec on RIN-1724): what the learner
 * can do next. Unlock with a credit, upgrade, or play a free quiz, which is always available.
 * It shares the header pill's wallet SWR key, so an unlock updates both.
 */
export function PremiumPreviewResultCard({
  slug,
  playedCount,
  fullQuestionCount,
  quizId,
  freeQuiz,
}: PremiumPreviewResultCardProps) {
  const t = useTranslations('quiz');
  const { mutate: mutateAll } = useSWRConfig();
  const remaining = fullQuestionCount - playedCount;
  const hasRemaining = remaining > 0;
  const wallet = useSWR(hasRemaining ? CREDIT_WALLET_KEY : null, fetchCreditWallet);
  const [phase, setPhase] = useState<UnlockPhase>('idle');
  const balance = wallet.data?.wallet.balance;
  const cannotAfford = balance !== undefined && balance < 1;

  async function unlock() {
    trackCta('unlock');
    setPhase('unlocking');
    try {
      await unlockPremiumQuiz(quizId);
    } catch {
      setPhase('failed');
      void wallet.mutate();
      return;
    }
    setPhase('unlocked');
    void mutateAll(CREDIT_WALLET_KEY);
  }

  if (phase === 'unlocked') {
    return (
      <CardShell>
        <h2 className="text-lg font-semibold text-ink">{t('premiumPreviewUnlockedTitle')}</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {t('premiumPreviewUnlockedText', { total: fullQuestionCount })}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href={ROUTES.QUIZ.VIEW(routePathSegment(slug))} className="btn btn-primary w-full">
            {t('premiumPreviewPlayFull')}
          </Link>
        </div>
      </CardShell>
    );
  }

  const unlocking = phase === 'unlocking';
  const walletLoading = hasRemaining && balance === undefined && !wallet.error;
  const upgradePrimary = !hasRemaining || cannotAfford;
  // The variant follows the balance, so a placeholder holds the place until it is known.
  const upgrade = walletLoading ? (
    <Skeleton className="h-11 w-full" />
  ) : (
    <Link
      href={ROUTES.SUBSCRIPTION}
      className={cn(
        'btn w-full',
        upgradePrimary ? 'btn-primary' : 'btn-secondary',
        unlocking && 'pointer-events-none opacity-60',
      )}
      onClick={() => trackCta('upgrade')}
      {...(unlocking ? { 'aria-disabled': true, tabIndex: -1 } : {})}
    >
      {t('premiumUpgradeLink')}
    </Link>
  );
  const unlockGroup = walletLoading ? (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-5 w-32" />
    </div>
  ) : (
    <div className="flex flex-col gap-2">
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
      <BalanceLine
        balance={balance}
        failed={Boolean(wallet.error) && balance === undefined}
        onRetry={() => void wallet.mutate()}
      />
    </div>
  );

  return (
    <CardShell>
      <h2 className="text-lg font-semibold text-ink">
        {hasRemaining
          ? t('premiumPreviewResultTitle', { shown: playedCount, total: fullQuestionCount })
          : t('premiumPreviewAllTitle', { total: fullQuestionCount })}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {hasRemaining ? t('premiumPreviewResultText', { remaining }) : t('premiumPreviewAllText')}
      </p>
      {phase === 'failed' ? (
        <p role="alert" className="mt-4 text-sm text-error">
          {t('premiumUnlockError')}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        {hasRemaining && upgradePrimary ? upgrade : null}
        {hasRemaining ? unlockGroup : upgrade}
        {hasRemaining && !upgradePrimary ? upgrade : null}
        <FreeQuizLink freeQuiz={freeQuiz} />
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <SurfaceCard className="mx-auto mb-8 w-full max-w-md p-4 text-left sm:p-5">
      {children}
    </SurfaceCard>
  );
}

function BalanceLine({
  balance,
  failed,
  onRetry,
}: {
  balance: number | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('quiz');
  if (failed) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
        <span>{t('premiumPreviewBalanceError')}</span>
        <Button
          variant="link"
          className="min-h-11 min-w-11 px-1 text-sm font-medium text-brand-trust"
          onClick={onRetry}
        >
          {t('premiumPreviewRetry')}
        </Button>
      </p>
    );
  }
  if (balance === undefined) return null;
  return <p className="text-sm text-ink-muted">{t('premiumCreditBalance', { count: balance })}</p>;
}

function FreeQuizLink({ freeQuiz }: { freeQuiz: { slug: string; title: string } | null }) {
  const t = useTranslations('quiz');
  return (
    <Link
      href={freeQuiz ? ROUTES.QUIZ.VIEW(routePathSegment(freeQuiz.slug)) : ROUTES.QUIZZES}
      className={LINK_CLASS}
      onClick={() => trackCta('free_quiz')}
    >
      {freeQuiz
        ? t('premiumPreviewFreeQuiz', { subject: freeQuiz.title })
        : t('premiumPreviewFreeQuizNoSubject')}
    </Link>
  );
}
