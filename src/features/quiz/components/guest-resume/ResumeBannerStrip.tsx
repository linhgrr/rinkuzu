'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineX } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { GoogleLogo } from '@/features/auth/components/GoogleLogo';
import {
  dismissResumeBanner,
  markResumeBannerSignIn,
  type ResumeBannerClaim,
} from '@/features/quiz/lib/guest-claims';
import { Link } from '@/i18n/navigation';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { withPending } from '@/lib/async/with-pending';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';

export type ResumeBannerPage = 'landing' | 'try' | 'explore';
export type ResumeBannerTone = 'app' | 'dark';

export interface ResumeBannerStripProps {
  claim: ResumeBannerClaim;
  page: ResumeBannerPage;
  tone: ResumeBannerTone;
  /** Where the strip sits relative to the page's fixed header. */
  placement: 'flow' | 'landing';
  /** Tailwind max-width of the inner row, matched to the page's first content block. */
  widthClass: string;
  onDismiss: () => void;
}

/** A guest draft is deleted 24 h after it is made (RIN-1448). */
const DRAFT_LIFETIME_HOURS = 24;

const STRIP_CLASS: Record<ResumeBannerTone, string> = {
  app: 'border-b border-line bg-surface-warm text-ink',
  dark: 'border-b border-white/10 bg-white/5 text-white',
};
const MUTED_CLASS: Record<ResumeBannerTone, string> = {
  app: 'text-ink-muted',
  dark: 'text-white/70',
};
const SEE_CLASS: Record<ResumeBannerTone, string> = {
  app: '',
  dark: 'border border-white/30 bg-transparent text-white hover:bg-white/10',
};
const CLOSE_CLASS: Record<ResumeBannerTone, string> = {
  app: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  dark: 'text-white/70 hover:bg-white/10 hover:text-white',
};

/** The result page that reads this claim; no token, no email. */
function resultPathOf(claim: ResumeBannerClaim['latest']): string {
  const params = new URLSearchParams({ attemptId: claim.attemptId });
  if (claim.score !== undefined) params.set('score', String(claim.score));
  return `${ROUTES.QUIZ.RESULT(encodeURIComponent(claim.quizSlug))}?${params.toString()}`;
}

/** The strip itself, loaded only once a claim exists (`GuestResumeBanner`). */
export default function ResumeBannerStrip({
  claim,
  page,
  tone,
  placement,
  widthClass,
  onDismiss,
}: ResumeBannerStripProps) {
  const t = useTranslations('guestDraft.resumeBanner');
  const locale = useLocale();
  const [signingIn, setSigningIn] = useState(false);
  const { latest, others, ageHours } = claim;
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    captureAnalyticsEvent('guest_resume_banner_shown', { page, claim_age_hours: ageHours });
  }, [page, ageHours]);

  const resultPath = resultPathOf(latest);
  const isDraft = latest.kind === 'draft';
  const lead = isDraft
    ? t('leadDraft', { hours: Math.max(1, DRAFT_LIFETIME_HOURS - ageHours) })
    : latest.score === undefined
      ? t('leadLegacy')
      : t('leadScore', { score: latest.score });
  const title = isDraft ? undefined : latest.quizTitle;
  const othersLabel = others > 0 ? t('others', { count: others }) : null;
  const props = { page, claim_age_hours: ageHours };

  const saveWithGoogle = () => {
    captureAnalyticsEvent('guest_resume_banner_clicked', { ...props, target: 'google' });
    markResumeBannerSignIn();
    const callbackUrl = resolveAuthCallback(resultPath, locale).browserUrl;
    void withPending(setSigningIn, () => signIn('google', { callbackUrl })).catch(() => undefined);
  };

  const dismiss = () => {
    dismissResumeBanner(latest.attemptId);
    captureAnalyticsEvent('guest_resume_banner_dismissed', props);
    onDismiss();
  };

  return (
    <section
      // A labelled <section> is the `region` landmark already.
      aria-label={t('region')}
      data-testid="guest-resume-banner"
      className={cn(
        'font-home',
        STRIP_CLASS[tone],
        // The landing header is fixed and 80 px high: the strip starts under it and gives
        // that band back, so the hero moves down by the strip's own height. `z-20` keeps
        // it above the landing `<main>` (z-10) that overlaps the band.
        placement === 'landing' && 'relative z-20 -mb-20 mt-20',
      )}
    >
      <div
        className={cn(
          'mx-auto flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-2 lg:px-8',
          widthClass,
        )}
      >
        <p className="flex min-w-0 flex-col text-sm leading-5 sm:flex-1 sm:flex-row sm:items-baseline sm:gap-1">
          <span className="font-semibold">{lead}</span>
          {title || othersLabel ? (
            <>
              {title ? (
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
              ) : null}
              <span className="flex min-w-0 gap-2">
                {title ? <span className="truncate">{title}</span> : null}
                {othersLabel ? (
                  <span className={cn('shrink-0', MUTED_CLASS[tone])}>{othersLabel}</span>
                ) : null}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-2 sm:ml-auto sm:shrink-0">
          <Button
            loading={signingIn}
            onClick={saveWithGoogle}
            className="flex-1 gap-2 whitespace-nowrap px-3 sm:flex-none sm:px-4"
          >
            <span className="hidden size-6 items-center justify-center rounded-full bg-white sm:inline-flex">
              <GoogleLogo />
            </span>
            {t('save')}
          </Button>
          <Link
            href={resultPath}
            onClick={() =>
              captureAnalyticsEvent('guest_resume_banner_clicked', { ...props, target: 'view' })
            }
            className={cn(
              'btn btn-secondary shrink-0 whitespace-nowrap px-3 sm:px-4',
              SEE_CLASS[tone],
            )}
          >
            {t('see')}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('dismiss')}
            onClick={dismiss}
            className={cn('shrink-0', CLOSE_CLASS[tone])}
          >
            <HiOutlineX className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
