'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { Link } from '@/i18n/navigation';
import { resolveAuthCallback, withAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';

export const GUEST_SIGN_UP_LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

/**
 * "Sign up to create more" when a guest cap is hit (RIN-1448 AC3). The same copy for the
 * per-IP and the global cap: the page never says which one fired.
 */
export function GuestDraftCapCard() {
  const t = useTranslations('guestDraft.cap');
  const locale = useLocale();
  const titleId = useId();
  const next = ROUTES.CREATE_QUIZ_PDF;

  return (
    <Card
      variant="bordered"
      role="status"
      aria-labelledby={titleId}
      className="border-orange-200 bg-orange-50 p-6 text-center"
    >
      <h2 id={titleId} className="text-lg font-semibold text-neutral-950">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-neutral-700">{t('body')}</p>
      <div className="mx-auto mt-4 w-full sm:max-w-xs">
        <GoogleAuthButton
          callbackUrl={resolveAuthCallback(next, locale).browserUrl}
          label={t('google')}
          describedBy={titleId}
        />
      </div>
      <div className="flex flex-col items-center">
        <Link href={withAuthCallback(ROUTES.LOGIN, next)} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('signInEmail')}
        </Link>
        <Link href={withAuthCallback(ROUTES.REGISTER, next)} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('createAccount')}
        </Link>
      </div>
    </Card>
  );
}
