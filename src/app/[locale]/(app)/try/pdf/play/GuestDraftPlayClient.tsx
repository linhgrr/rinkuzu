'use client';

import { useTranslations } from 'next-intl';
import { CenteredCardPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  GuestDraftExpiredCard,
  GuestDraftNotice,
} from '@/features/guest-draft/components/GuestDraftPlayStates';
import { useGuestDraftPlay } from '@/features/guest-draft/hooks/useGuestDraftPlay';
import { MoreQuestionsComingContext } from '@/features/quiz/components/player/QuestionTotal';
import { GUEST_DRAFT_PLAY_SLUG, type GuestDraftSource } from '@/shared/constants/guest-draft';
import QuizPlayerClient from '../../../quiz/[slug]/QuizPlayerClient';

/** The notice's pending line: shown while the rest may come, its space kept after (RIN-1620). */
function noticeMore(load: { pending: boolean; openedPending: boolean }) {
  if (load.pending) return 'pending';
  return load.openedPending ? 'settled' : 'none';
}

/**
 * The RIN-912 guest player on the visitor's newest guest draft (RIN-1448), for `/try/pdf`
 * and `/try/text` (RIN-1539): `source` only changes the notice and expired copy. A draft
 * that opens on its first batch appends the rest to the running round (RIN-1620).
 */
export function GuestDraftPlayClient({ source = 'pdf' }: { source?: GuestDraftSource }) {
  const t = useTranslations('guestDraft.play');
  const { load, retry } = useGuestDraftPlay(source);

  if (load.status === 'loading') return <CenteredCardPageSkeleton label={t('loading')} />;
  if (load.status === 'expired') return <GuestDraftExpiredCard source={source} />;
  if (load.status === 'error') {
    return <ErrorState error={load.error} variant="page" onRetry={retry} />;
  }
  return (
    <MoreQuestionsComingContext value={load.pending}>
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorStatus={null}
        initialQuiz={load.quiz}
        slug={GUEST_DRAFT_PLAY_SLUG}
        mode="full"
        guestDraft={{
          submitAttempt: load.submitAttempt,
          notice: <GuestDraftNotice source={source} more={noticeMore(load)} />,
          moreQuestions: load.moreQuestions,
        }}
      />
    </MoreQuestionsComingContext>
  );
}
