'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  fetchReviewReminderOptedIn,
  saveReviewReminder,
} from '@/features/quiz/api/review-reminder-api';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { cn } from '@/lib/utils';
import { QUICK_ROUND_SIZE } from '@/shared/constants/quick-round';

/** Analytics campaign for the week-1 return loop (RIN-911); events carry nothing else but `missed_count`. */
const REVIEW_CAMPAIGN = 'w1-review';

const PRIMARY_LINK = 'btn btn-primary w-full h-12 px-8 text-base';
const SECONDARY_LINK = 'btn btn-secondary w-full min-h-11 text-center';

export type ResultViewer = 'signed_in' | 'guest' | 'pending';

interface ResultActionsProps {
  attemptId: string;
  slug: string;
  missedCount: number;
  nextQuiz: { slug: string; title: string } | null;
  viewer: ResultViewer;
  contentLocked: boolean;
  /** Result of a quick round (RIN-933): "Another 10" and "Full quiz" replace the redo link. */
  quickRound?: boolean;
}

type PrimaryAction = 'retry' | 'another' | 'quickAnother' | 'home';

function choosePrimary(
  canPersonalize: boolean,
  missedCount: number,
  hasNextQuiz: boolean,
  quickRound: boolean,
): PrimaryAction {
  if (canPersonalize && missedCount > 0) return 'retry';
  if (quickRound) return 'quickAnother';
  if (!canPersonalize) return 'home';
  return hasNextQuiz ? 'another' : 'home';
}

/**
 * Result-page actions (RIN-917, Designer spec on the issue): exactly one primary
 * button ("Retry the N you missed", "Try another quiz", or Back Home), the
 * outline secondaries, and the opt-in review-email checkbox for signed-in learners.
 * Guests get no retry or checkbox; the page shows them the RIN-912 save-result card.
 */
export function ResultActions({
  attemptId,
  slug,
  missedCount,
  nextQuiz,
  viewer,
  contentLocked,
  quickRound = false,
}: ResultActionsProps) {
  const t = useTranslations('quiz.resultActions');
  const tQuiz = useTranslations('quiz');
  const encodedSlug = routePathSegment(slug);
  const canPersonalize = viewer === 'signed_in' && !contentLocked;
  const primary = choosePrimary(canPersonalize, missedCount, nextQuiz !== null, quickRound);
  const quickAnother = {
    href: `/quiz/${encodedSlug}?mode=quick`,
    label: tQuiz('quickRound.another', { count: QUICK_ROUND_SIZE }),
  };
  const analytics = { campaign: REVIEW_CAMPAIGN, missed_count: missedCount };

  let primaryNode;
  if (viewer === 'pending' && !contentLocked) {
    primaryNode = <Skeleton aria-hidden="true" className="h-12 w-full" />;
  } else if (primary === 'retry') {
    primaryNode = (
      <Link
        href={`/quiz/${encodedSlug}?retryOf=${encodeURIComponent(attemptId)}`}
        className={PRIMARY_LINK}
        onClick={() => captureAnalyticsEvent('retry_missed_clicked', analytics)}
      >
        {t('retryMissed', { count: missedCount })}
      </Link>
    );
  } else if (primary === 'another' && nextQuiz) {
    primaryNode = (
      <Link
        href={`/quiz/${routePathSegment(nextQuiz.slug)}`}
        className={PRIMARY_LINK}
        onClick={() => captureAnalyticsEvent('try_another_quiz_clicked', analytics)}
      >
        {t('tryAnother')}
      </Link>
    );
  } else if (primary === 'quickAnother') {
    primaryNode = (
      <Link href={quickAnother.href} className={PRIMARY_LINK}>
        {quickAnother.label}
      </Link>
    );
  } else {
    primaryNode = (
      <Link href="/" className={PRIMARY_LINK}>
        {tQuiz('backHome')}
      </Link>
    );
  }

  const showHomeAsSecondary = primary !== 'home' || viewer === 'pending';
  // Three quick-round secondaries stack; two sit side by side from 400 px.
  const stackSecondaries = !showHomeAsSecondary || (quickRound && primary !== 'quickAnother');

  return (
    <div className="mx-auto mb-8 flex w-full max-w-md flex-col gap-3">
      {primaryNode}
      <div
        className={cn(
          'grid gap-3',
          stackSecondaries ? 'grid-cols-1' : 'grid-cols-1 min-[400px]:grid-cols-2',
        )}
      >
        {quickRound ? (
          <QuickRoundSecondaries
            another={primary === 'quickAnother' ? null : quickAnother}
            fullHref={`/quiz/${encodedSlug}?mode=full`}
            fullLabel={tQuiz('quickRound.fullQuiz')}
          />
        ) : (
          <Link href={`/quiz/${encodedSlug}`} className={SECONDARY_LINK}>
            {tQuiz('redo')}
          </Link>
        )}
        {showHomeAsSecondary ? (
          <Link href="/" className={SECONDARY_LINK}>
            {tQuiz('backHome')}
          </Link>
        ) : null}
      </div>
      {canPersonalize ? <ReviewEmailOptIn attemptId={attemptId} missedCount={missedCount} /> : null}
    </div>
  );
}

function QuickRoundSecondaries({
  another,
  fullHref,
  fullLabel,
}: {
  another: { href: string; label: string } | null;
  fullHref: string;
  fullLabel: string;
}) {
  return (
    <>
      {another ? (
        <Link href={another.href} className={SECONDARY_LINK}>
          {another.label}
        </Link>
      ) : null}
      <Link href={fullHref} className={SECONDARY_LINK}>
        {fullLabel}
      </Link>
    </>
  );
}

type SavePhase = 'idle' | 'saving' | 'saved' | 'error';

function ReviewEmailOptIn({ attemptId, missedCount }: { attemptId: string; missedCount: number }) {
  const t = useTranslations('quiz.resultActions');
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const [checked, setChecked] = useState(false);
  const [phase, setPhase] = useState<SavePhase>('idle');
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    // Revisit: show the box ticked when the learner already opted in. A failed
    // read leaves it unticked; ticking again is idempotent on the server.
    fetchReviewReminderOptedIn()
      .then((optedIn) => {
        if (active && optedIn) setChecked(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const save = async (optIn: boolean) => {
    const previous = !optIn;
    setChecked(optIn);
    setPendingValue(optIn);
    setPhase('saving');
    try {
      await saveReviewReminder({ attemptId, optIn, locale });
      setPhase('saved');
      if (optIn) {
        captureAnalyticsEvent('review_email_opt_in', {
          campaign: REVIEW_CAMPAIGN,
          missed_count: missedCount,
        });
      }
    } catch {
      setChecked(previous);
      setPhase('error');
    }
  };

  let status: React.ReactNode = null;
  if (phase === 'saving') status = t('saving');
  if (phase === 'saved') status = pendingValue ? t('savedOn') : t('savedOff');
  if (phase === 'error') {
    status = (
      <span className="text-error">
        {t('saveError')}{' '}
        <Button
          variant="link"
          className="font-medium text-error"
          onClick={() => pendingValue !== null && void save(pendingValue)}
        >
          {t('tryAgain')}
        </Button>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-[var(--brand-trust)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          checked={checked}
          disabled={phase === 'saving'}
          aria-busy={phase === 'saving'}
          onChange={(event) => void save(event.target.checked)}
        />
        {t('reviewEmail')}
      </label>
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-neutral-600">
        {status}
      </p>
    </div>
  );
}
