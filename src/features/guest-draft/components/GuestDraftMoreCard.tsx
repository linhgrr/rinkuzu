'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineRefresh } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { useGuestDraftMore } from '@/features/guest-draft/hooks/useGuestDraftMore';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

/**
 * Under the score of a first-batch round (RIN-1620, spec state 5): exactly one of "more on
 * the way", "N more ready" with Keep going, or the quiet failed line. It swaps in place
 * and keeps its height, so the sign-up block below never jumps. Nothing for a full round.
 */
export function GuestDraftMoreCard({ attemptId }: { attemptId: string | null }) {
  const t = useTranslations('guestDraft.result');
  const { round, more } = useGuestDraftMore(attemptId);
  if (!round || !more) return null;

  const keepGoingHref = `${round.source === 'text' ? ROUTES.TRY_TEXT_PLAY : ROUTES.TRY_PDF_PLAY}?from=${round.from + round.count}`;
  return (
    <Card
      variant="bordered"
      role="status"
      data-testid="guest-draft-more"
      className="mb-6 flex min-h-32 flex-col justify-center p-5"
    >
      {more.kind === 'pending' ? (
        <>
          <h2 className="flex items-center gap-2 font-semibold text-neutral-950">
            <HiOutlineRefresh
              className="size-5 flex-shrink-0 text-neutral-500 motion-safe:animate-spin"
              aria-hidden="true"
            />
            {t('moreTitle')}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{t('moreBody')}</p>
        </>
      ) : null}
      {more.kind === 'arrived' ? (
        <>
          <h2 className="font-semibold text-neutral-950">
            {t('arrivedTitle', { count: more.count })}
          </h2>
          <Link
            href={keepGoingHref}
            className="btn btn-secondary mt-4 min-h-11 w-full sm:w-auto sm:self-start"
          >
            {t('keepGoing')}
          </Link>
        </>
      ) : null}
      {more.kind === 'failed' ? <p className="text-sm text-neutral-600">{t('failed')}</p> : null}
    </Card>
  );
}
