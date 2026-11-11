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
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import type { GuestDraftEntry } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';

const SIGN_UP_HREF = withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ_PDF);

function UploadAlert({ alert }: { alert: GuestUploadState['alert'] }) {
  const t = useTranslations('guestDraft.alerts');
  if (!alert) return null;
  const message =
    alert === 'too_large'
      ? t('tooLarge', GUEST_DRAFT_LIMIT_COPY)
      : alert === 'not_pdf'
        ? t('notPdf')
        : t('uploadError');
  return (
    <div className="space-y-1">
      <CreateQuizErrorAlert message={message} focusOnShow />
      {alert === 'too_large' ? (
        <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('tooLargeLink')}
        </Link>
      ) : null}
    </div>
  );
}

type Flow = ReturnType<typeof useGuestPdfDraft>;

function UploadForm({ flow }: { flow: Flow }) {
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

function FlowBody({ flow }: { flow: Flow }) {
  const { state } = flow;
  const { phase, file } = state;
  if (phase === 'cap') return <GuestDraftCapCard />;
  if (phase === 'failed') {
    return (
      <GuestDraftFailedCard onRetry={() => void flow.submit()} onChooseAnother={flow.remove} />
    );
  }
  if (file && (phase === 'uploading' || phase === 'processing' || phase === 'ready')) {
    return (
      <GuestDraftProgressCard
        phase={phase}
        label={file.name}
        meta={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
        progress={state.progress}
        pollErrors={state.pollErrors}
        onCancel={flow.cancel}
        onPlayNow={flow.playNow}
      />
    );
  }
  return <UploadForm flow={flow} />;
}

interface GuestPdfUploadPageProps {
  entry?: GuestDraftEntry | undefined;
  /** Server-rendered copy under the widget (RIN-1498); the widget stays first on screen. */
  children?: ReactNode;
}

/** `/try/pdf` (RIN-1448): a signed-out visitor turns their own PDF into a quiz and plays it. */
export function GuestPdfUploadPage({ entry, children }: GuestPdfUploadPageProps) {
  const t = useTranslations('guestDraft.upload');
  const flow = useGuestPdfDraft(entry);

  return (
    <main className="min-h-dvh bg-neutral-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-3">
          <Pill>{t('badge')}</Pill>
          <h1 className="text-3xl font-bold leading-tight text-neutral-950 lg:text-4xl">
            {t('title')}
          </h1>
          <p className="text-base text-neutral-600">{t('subtitle', GUEST_DRAFT_LIMIT_COPY)}</p>
        </header>
        <FlowBody flow={flow} />
        <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('higherLimits')}
        </Link>
        {children}
      </div>
    </main>
  );
}
