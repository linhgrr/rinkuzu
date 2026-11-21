'use client';

import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import {
  GUEST_SIGN_UP_LINK_CLASS,
  GuestDraftCapCard,
} from '@/features/guest-draft/components/GuestDraftCapCard';
import {
  GuestDraftFailedCard,
  GuestDraftProgressCard,
} from '@/features/guest-draft/components/GuestDraftProgressCard';
import { useGuestImageDraft } from '@/features/guest-draft/hooks/useGuestImageDraft';
import type { GuestUploadState } from '@/features/guest-draft/lib/guest-upload-state';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import { GuestResumeBanner } from '@/features/quiz/components/guest-resume/GuestResumeBanner';
import { QuizPhotoPicker } from '@/features/quiz-images/components/QuizPhotoPicker';
import { useQuizPhotos, type QuizPhotosState } from '@/features/quiz-images/hooks/useQuizPhotos';
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import { GUEST_DRAFT_MAX_QUESTIONS } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';

const SIGN_UP_HREF = withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ);
const MB = 1024 * 1024;

type Flow = ReturnType<typeof useGuestImageDraft>;

/** The set-level alert above the photos; the photos stay so one can be retaken (UI spec RIN-1791, 4). */
function PhotoAlert({ alert }: { alert: GuestUploadState['alert'] }) {
  const t = useTranslations('guestDraft.photo');
  if (alert === 'too_little_text') {
    return (
      <div className="space-y-1">
        <CreateQuizErrorAlert message={t('tooLittleText')} focusOnShow />
        <Link href={ROUTES.TRY_TEXT} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('pasteTextLink')}
        </Link>
      </div>
    );
  }
  if (alert === 'upload_error') {
    return <CreateQuizErrorAlert message={t('sendError')} focusOnShow />;
  }
  return null;
}

/** The 503 (kill switch or outage): no retry, it would hit the same wall; the photos are dropped. */
function PhotoUnavailableCard() {
  const t = useTranslations('guestDraft.photo');
  return (
    <Card variant="bordered" role="alert" className="space-y-4 border-red-200 bg-red-50 p-5 sm:p-6">
      <div className="flex items-start gap-3 text-red-700">
        <HiOutlineExclamationCircle className="mt-0.5 size-6 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold">{t('unavailableTitle')}</h2>
          <p className="mt-1 text-sm">{t('unavailableBody')}</p>
        </div>
      </div>
      <Link href={ROUTES.TRY_TEXT} className="btn btn-primary w-full sm:w-auto">
        {t('pasteTextLink')}
      </Link>
    </Card>
  );
}

interface FlowBodyProps {
  flow: Flow;
  photos: QuizPhotosState;
}

function FlowBody({ flow, photos }: FlowBodyProps) {
  const t = useTranslations('guestDraft.photo');
  const format = useFormatter();
  const { state } = flow;
  const { phase, alert } = state;
  const unavailable = phase === 'idle' && alert === 'service_unavailable';

  // A paused feature keeps nothing: the photos are dropped, not just hidden.
  const dropPhotos = useEffectEvent(photos.clear);
  const holdsPhotos = photos.photos.length > 0;
  useEffect(() => {
    if (unavailable && holdsPhotos) dropPhotos();
  }, [unavailable, holdsPhotos]);

  if (phase === 'cap') return <GuestDraftCapCard source="image" />;
  if (unavailable) return <PhotoUnavailableCard />;
  if (phase === 'failed') {
    return (
      <GuestDraftFailedCard
        source="image"
        onRetry={() => void flow.submit(photos.blobs)}
        onChooseAnother={flow.edit}
      />
    );
  }
  if (phase === 'uploading' || phase === 'processing' || phase === 'ready') {
    return (
      <GuestDraftProgressCard
        phase={phase}
        source="image"
        label={t('progressLabel', {
          count: photos.readyCount,
          size: format.number(photos.totalBytes / MB, { maximumFractionDigits: 1 }),
        })}
        progress={state.progress}
        pollErrors={state.pollErrors}
        onCancel={flow.cancel}
        onPlayNow={flow.playNow}
      />
    );
  }
  const retry = alert === 'upload_error' || alert === 'too_little_text';
  return (
    <QuizPhotoPicker
      photos={photos}
      alert={<PhotoAlert alert={alert} />}
      submit={{
        label: retry ? t('tryAgain') : t('submit'),
        loading: false,
        onClick: () => void flow.submit(photos.blobs),
      }}
    />
  );
}

/**
 * `/try/photo` (RIN-1793): a signed-out visitor takes or picks 1-5 photos of a book, notes
 * or slides, the API reads the text, and up to 10 questions are ready to play. Laid out like
 * `/try/text`. The photos live in this component's state only (kept for "Try again" and
 * "Change photos"); they are never stored, shown outside the picker or sent to analytics.
 */
export function GuestPhotoPage({ children }: { children?: ReactNode }) {
  const t = useTranslations('guestDraft.photo');
  const flow = useGuestImageDraft();
  const photos = useQuizPhotos('try_photo');

  return (
    <>
      <GuestResumeBanner page="try" widthClass="max-w-5xl" mainId="main-content" />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-dvh bg-neutral-50 px-4 py-8 outline-none sm:px-6"
      >
        <div className="mx-auto max-w-xl space-y-6">
          <Pill>{t('badge')}</Pill>
          <h1 className="text-3xl font-bold leading-tight text-neutral-950 lg:text-4xl">
            {t('title')}
          </h1>
          <p className="text-base text-neutral-600">
            {t('subtitle', { questions: GUEST_DRAFT_MAX_QUESTIONS })}
          </p>
          <FlowBody flow={flow} photos={photos} />
          <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
            {t('higherLimits')}
          </Link>
          {children}
        </div>
      </main>
    </>
  );
}
