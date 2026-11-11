'use client';

import { useTranslations } from 'next-intl';
import { CenteredCardPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  GuestDraftExpiredCard,
  GuestDraftNotice,
} from '@/features/guest-draft/components/GuestDraftPlayStates';
import { useGuestDraftPlay } from '@/features/guest-draft/hooks/useGuestDraftPlay';
import { GUEST_DRAFT_PLAY_SLUG, type GuestDraftSource } from '@/shared/constants/guest-draft';
import QuizPlayerClient from '../../../quiz/[slug]/QuizPlayerClient';

/**
 * The RIN-912 guest player on the visitor's newest guest draft (RIN-1448), for `/try/pdf`
 * and `/try/text` (RIN-1539): `source` only changes the notice and expired copy.
 */
export function GuestDraftPlayClient({ source = 'pdf' }: { source?: GuestDraftSource }) {
  const t = useTranslations('guestDraft.play');
  const { load, retry } = useGuestDraftPlay();

  if (load.status === 'loading') return <CenteredCardPageSkeleton label={t('loading')} />;
  if (load.status === 'expired') return <GuestDraftExpiredCard source={source} />;
  if (load.status === 'error') {
    return <ErrorState error={load.error} variant="page" onRetry={retry} />;
  }
  return (
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorStatus={null}
      initialQuiz={load.quiz}
      slug={GUEST_DRAFT_PLAY_SLUG}
      mode="full"
      guestDraft={{
        submitAttempt: load.submitAttempt,
        notice: <GuestDraftNotice source={source} />,
      }}
    />
  );
}
