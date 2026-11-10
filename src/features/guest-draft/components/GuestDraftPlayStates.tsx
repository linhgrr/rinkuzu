'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineClock } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { GUEST_SIGN_UP_LINK_CLASS } from '@/features/guest-draft/components/GuestDraftCapCard';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

/** Slim note above question 1 of a guest draft (RIN-1448): kept 24 h unless you sign up. */
export function GuestDraftNotice() {
  const t = useTranslations('guestDraft.play');
  return (
    <p className="rounded-xl bg-orange-50 px-4 py-2 text-sm text-neutral-700">
      {t.rich('notice', {
        link: (chunks) => (
          <Link href={ROUTES.REGISTER} className={GUEST_SIGN_UP_LINK_CLASS}>
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

/** The draft is gone (after 24 h, claimed, or another browser): offer to make it again. */
export function GuestDraftExpiredCard() {
  const t = useTranslations('guestDraft.play');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-8">
      <Card variant="bordered" className="w-full max-w-md p-6 text-center">
        <HiOutlineClock className="mx-auto mb-3 size-8 text-neutral-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-neutral-950">{t('expiredTitle')}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t('expiredBody')}</p>
        <Link href={ROUTES.TRY_PDF} className="btn btn-primary mt-4">
          {t('makeAgain')}
        </Link>
      </Card>
    </main>
  );
}
