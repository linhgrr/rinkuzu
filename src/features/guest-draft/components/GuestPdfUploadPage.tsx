'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import {
  GUEST_SIGN_UP_LINK_CLASS,
  GuestDraftCapCard,
} from '@/features/guest-draft/components/GuestDraftCapCard';
import {
  GuestDraftFailedCard,
  GuestDraftProgressCard,
} from '@/features/guest-draft/components/GuestDraftProgressCard';
import { GuestPdfDropZone } from '@/features/guest-draft/components/GuestPdfDropZone';
import { useGuestPdfDraft } from '@/features/guest-draft/hooks/useGuestPdfDraft';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';
import type { GuestUploadState } from '@/features/guest-draft/lib/guest-upload-state';
import { GuestResumeBanner } from '@/features/quiz/components/guest-resume/GuestResumeBanner';
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import type { GuestDraftOfficeSurface } from '@/shared/constants/guest-draft';
import { QUIZ_TEXT_MAX_CHARS } from '@/shared/constants/quiz-text-source';
import { ROUTES } from '@/shared/constants/routes';

const SIGN_UP_HREF = withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ_PDF);

type UploadAlertKey = NonNullable<GuestUploadState['alert']>;

/** The message key of each refusal; the PDF over-limit one also takes the trial limits. */
const ALERT_MESSAGE = {
  too_large: 'tooLarge',
  too_short: 'uploadError',
  not_pdf: 'notPdf',
  upload_error: 'uploadError',
  office_too_large: 'officeTooLarge',
  legacy_format: 'legacyFormat',
  encrypted: 'encrypted',
  corrupt: 'corrupt',
  too_little_text: 'tooLittleText',
  service_unavailable: 'uploadError',
} as const satisfies Record<UploadAlertKey, string>;

/** Links under the message: sign up for a PDF over the limit, another way in for no text. */
function AlertLinks({ alert }: { alert: UploadAlertKey }) {
  const t = useTranslations('guestDraft.alerts');
  if (alert === 'too_large') {
    return (
      <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
        {t('tooLargeLink')}
      </Link>
    );
  }
  if (alert !== 'too_little_text') return null;
  return (
    <div className="flex flex-wrap gap-x-4">
      <Link href={ROUTES.TRY_PDF} className={GUEST_SIGN_UP_LINK_CLASS}>
        {t('pdfVersionLink')}
      </Link>
      <Link href={ROUTES.TRY_TEXT} className={GUEST_SIGN_UP_LINK_CLASS}>
        {t('pasteTextLink')}
      </Link>
    </div>
  );
}

function UploadAlert({ alert }: { alert: GuestUploadState['alert'] }) {
  const t = useTranslations('guestDraft.alerts');
  if (!alert) return null;
  return (
    <div className="space-y-1">
      <CreateQuizErrorAlert message={t(ALERT_MESSAGE[alert], GUEST_DRAFT_LIMIT_COPY)} focusOnShow />
      <AlertLinks alert={alert} />
    </div>
  );
}

type Flow = ReturnType<typeof useGuestPdfDraft>;

function UploadForm({ flow, slides }: { flow: Flow; slides: boolean }) {
  const t = useTranslations('guestDraft.upload');
  const { state } = flow;
  const checking = state.phase === 'checking';
  return (
    <>
      <UploadAlert alert={state.alert} />
      <GuestPdfDropZone
        file={state.file}
        checking={checking}
        disabled={false}
        slides={slides}
        onChoose={(file) => void flow.choose(file)}
        onRemove={flow.remove}
      />
      <Button
        size="lg"
        loading={checking}
        disabled={!state.file || checking}
        onClick={() => void flow.submit()}
        className="h-14 w-full sm:w-auto sm:min-w-64"
      >
        {state.alert === 'upload_error' ? t('tryAgain') : t('submit')}
      </Button>
      <p className="text-xs text-neutral-500">{t('privacy')}</p>
    </>
  );
}

function FlowBody({ flow, slides }: { flow: Flow; slides: boolean }) {
  const t = useTranslations('guestDraft.upload');
  const { state, office } = flow;
  const { phase, file } = state;
  if (phase === 'cap') return <GuestDraftCapCard />;
  if (phase === 'failed') {
    return (
      <GuestDraftFailedCard
        office={office}
        onRetry={() => void flow.submit()}
        onChooseAnother={flow.remove}
      />
    );
  }
  if (file && (phase === 'uploading' || phase === 'processing' || phase === 'ready')) {
    return (
      <div className="space-y-3">
        <GuestDraftProgressCard
          phase={phase}
          // Only the text of a Word or PowerPoint file is sent: "Sending...", not "Uploading...".
          source={office ? 'text' : 'pdf'}
          label={file.name}
          meta={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          progress={state.progress}
          pollErrors={state.pollErrors}
          onCancel={flow.cancel}
          onPlayNow={flow.playNow}
        />
        {flow.truncated ? (
          <p className="text-xs text-neutral-500">
            {t('truncatedNote', { max: QUIZ_TEXT_MAX_CHARS })}
          </p>
        ) : null}
      </div>
    );
  }
  return <UploadForm flow={flow} slides={slides} />;
}

interface GuestPdfUploadPageProps {
  /** Server-rendered copy under the widget (RIN-1498); the widget stays first on screen. */
  children?: ReactNode;
  /**
   * The page this is mounted on, for the upload counters; `/try/slides` (RIN-1788) passes
   * `try_slides`, which also leads the copy with PowerPoint and Word.
   */
  surface?: GuestDraftOfficeSurface;
}

/**
 * `/try/pdf` (RIN-1448): a signed-out visitor turns their own PDF, Word or PowerPoint file
 * into a quiz and plays it.
 */
export function GuestPdfUploadPage({ children, surface = 'try_pdf' }: GuestPdfUploadPageProps) {
  const t = useTranslations('guestDraft.upload');
  const flow = useGuestPdfDraft(surface);
  const slides = surface === 'try_slides';

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
            {t(slides ? 'slidesTitle' : 'title')}
          </h1>
          <p className="text-base text-neutral-600">
            {t(slides ? 'slidesSubtitle' : 'subtitle', GUEST_DRAFT_LIMIT_COPY)}
          </p>
          <FlowBody flow={flow} slides={slides} />
          <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
            {t('higherLimits')}
          </Link>
          {children}
        </div>
      </main>
    </>
  );
}
