'use client';

import { useEffect, useEffectEvent, useId, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { markGuestClaimReviewOptIn } from '@/features/quiz/lib/guest-claims';
import { Link } from '@/i18n/navigation';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { resolveAuthCallback, withAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';

interface GuestSaveResultCardProps {
  /** Locale-unprefixed result URL to come back to after sign-in (no email, no token). */
  resultPath: string;
  /**
   * `review`: the attempt loaded; `scoreOnly`: only the score from the URL (no review promise);
   * `draft`: a quiz from the visitor's own PDF, deleted after 24 h unless they sign up (RIN-1448).
   */
  variant: 'review' | 'scoreOnly' | 'draft';
  /**
   * Questions answered wrong in this attempt. With the `review` variant and at least one, the
   * card leads with the 2-day review offer instead of "save your result" (RIN-1712).
   */
  wrongCount?: number;
  /** Tracked entry (blog, hub, ...) for the offer analytics; `direct` when none. */
  entry?: string | undefined;
  /** The attempt this card is for: the Google tap on the offer marks its stored claim. */
  attemptId?: string | null;
}

const COPY_KEYS = {
  review: { title: 'guestSaveTitle', body: 'guestSaveBody', google: 'guestSaveWithGoogle' },
  scoreOnly: {
    title: 'guestSaveTitle',
    body: 'guestSaveScoreOnlyBody',
    google: 'guestSaveWithGoogle',
  },
  draft: {
    title: 'guestDraftSaveTitle',
    body: 'guestDraftSaveBody',
    google: 'guestDraftSaveWithGoogle',
  },
} as const;

/** The review offer's own copy; the card keeps the same structure (RIN-1712). */
const REVIEW_OFFER_COPY_KEYS = {
  title: 'guestReviewOfferTitle',
  body: 'guestReviewOfferBody',
  google: 'guestReviewOfferGoogle',
} as const;

const LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

/** "Save your result and get your personalized review" for a signed-out learner (RIN-912). */
export function GuestSaveResultCard({
  resultPath,
  variant,
  wrongCount = 0,
  entry,
  attemptId = null,
}: GuestSaveResultCardProps) {
  const t = useTranslations('quiz');
  const locale = useLocale();
  const titleId = useId();
  const googleCallbackUrl = resolveAuthCallback(resultPath, locale).browserUrl;
  const reviewOffer = variant === 'review' && wrongCount >= 1;
  const copy = reviewOffer ? REVIEW_OFFER_COPY_KEYS : COPY_KEYS[variant];
  const analytics = { count_wrong: wrongCount, entry: entry ?? 'direct' };
  const offerShown = useRef(false);

  const reportOfferShown = useEffectEvent(() => {
    captureAnalyticsEvent('guest_review_offer_shown', analytics);
  });

  useEffect(() => {
    if (!reviewOffer || offerShown.current) return;
    offerShown.current = true;
    reportOfferShown();
  }, [reviewOffer]);

  const markReviewOptIn = () => {
    if (!reviewOffer) return;
    if (attemptId) markGuestClaimReviewOptIn(attemptId);
    captureAnalyticsEvent('guest_review_offer_clicked', analytics);
  };

  return (
    <section aria-labelledby={titleId} className="mb-6">
      <Card variant="bordered" className="border-green-200 bg-green-50 p-6 text-center">
        <HiOutlineLightBulb className="mx-auto mb-2 size-6 text-brand-trust" aria-hidden="true" />
        <h2 id={titleId} className="font-semibold text-brand-trust">
          {t(copy.title, { count: wrongCount })}
        </h2>
        <p className="mt-1 text-sm text-brand-trust">{t(copy.body)}</p>
        <div className="mx-auto mt-4 w-full sm:max-w-xs">
          <GoogleAuthButton
            callbackUrl={googleCallbackUrl}
            label={t(copy.google)}
            describedBy={titleId}
            onBeforeSignIn={markReviewOptIn}
          />
        </div>
        <div className="flex flex-col items-center">
          <Link href={withAuthCallback(ROUTES.LOGIN, resultPath)} className={LINK_CLASS}>
            {t('guestSaveSignInEmail')}
          </Link>
          <Link href={withAuthCallback(ROUTES.REGISTER, resultPath)} className={LINK_CLASS}>
            {t('guestSaveCreateAccount')}
          </Link>
        </div>
      </Card>
    </section>
  );
}
