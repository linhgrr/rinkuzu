'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { Link } from '@/i18n/navigation';
import { resolveAuthCallback, withAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';

interface GuestSaveResultCardProps {
  /** Locale-unprefixed result URL to come back to after sign-in (no email, no token). */
  resultPath: string;
  /** `review`: the attempt loaded; `scoreOnly`: only the score from the URL (no review promise). */
  variant: 'review' | 'scoreOnly';
}

const LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

/** "Save your result and get your personalized review" for a signed-out learner (RIN-912). */
export function GuestSaveResultCard({ resultPath, variant }: GuestSaveResultCardProps) {
  const t = useTranslations('quiz');
  const locale = useLocale();
  const titleId = useId();
  const googleCallbackUrl = resolveAuthCallback(resultPath, locale).browserUrl;

  return (
    <section aria-labelledby={titleId} className="mb-6">
      <Card variant="bordered" className="border-green-200 bg-green-50 p-6 text-center">
        <HiOutlineLightBulb className="mx-auto mb-2 size-6 text-brand-trust" aria-hidden="true" />
        <h2 id={titleId} className="font-semibold text-brand-trust">
          {t('guestSaveTitle')}
        </h2>
        <p className="mt-1 text-sm text-brand-trust">
          {variant === 'review' ? t('guestSaveBody') : t('guestSaveScoreOnlyBody')}
        </p>
        <div className="mx-auto mt-4 w-full sm:max-w-xs">
          <GoogleAuthButton
            callbackUrl={googleCallbackUrl}
            label={t('guestSaveWithGoogle')}
            describedBy={titleId}
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
