'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { HiOutlineClock } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

/**
 * The notice link: orange-800 is 8.9:1 on the orange-50 strip in both themes, where
 * `text-brand-trust` turns green in dark (1.9:1). RIN-1480 [P2].
 */
const NOTICE_LINK_CLASS =
  'inline-flex min-h-11 items-center font-medium text-orange-800 underline hover:text-orange-900';

/** Slim note above question 1 of a guest draft (RIN-1448): kept 24 h unless you sign up. */
export function GuestDraftNotice() {
  const t = useTranslations('guestDraft.play');
  return (
    <p className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-2 text-sm text-neutral-700">
      {t.rich('notice', {
        link: (chunks) => (
          <Link href={ROUTES.REGISTER} className={NOTICE_LINK_CLASS}>
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

/**
 * The draft is gone (after 24 h, claimed, or another browser): offer to make it again.
 * A signed-in visitor also gets their library, where a claimed draft lives (RIN-1485).
 */
export function GuestDraftExpiredCard() {
  const t = useTranslations('guestDraft.play');
  const signedIn = useSession().status === 'authenticated';
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-8">
      <Card variant="bordered" className="w-full max-w-md p-6 text-center">
        <HiOutlineClock className="mx-auto mb-3 size-8 text-neutral-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-neutral-950">{t('expiredTitle')}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t('expiredBody')}</p>
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href={ROUTES.TRY_PDF} className="btn btn-primary">
            {t('makeAgain')}
          </Link>
          {signedIn ? (
            <Link href={ROUTES.MY_QUIZZES} className="btn btn-secondary">
              {t('goToLibrary')}
            </Link>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
