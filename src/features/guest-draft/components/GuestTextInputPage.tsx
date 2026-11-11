'use client';

import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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
import { QuizTextField } from '@/features/guest-draft/components/QuizTextField';
import { useGuestTextDraft } from '@/features/guest-draft/hooks/useGuestTextDraft';
import { quizTextLimitState } from '@/features/guest-draft/lib/quiz-text-limit';
import type { GuestUploadState } from '@/features/guest-draft/lib/guest-upload-state';
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import type { GuestDraftEntry } from '@/shared/constants/guest-draft';
import { QUIZ_TEXT_MAX_CHARS, QUIZ_TEXT_MIN_CHARS } from '@/shared/constants/quiz-text-source';
import { ROUTES } from '@/shared/constants/routes';

const SIGN_UP_HREF = withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ);
const LIMITS = { min: QUIZ_TEXT_MIN_CHARS, max: QUIZ_TEXT_MAX_CHARS } as const;

type Flow = ReturnType<typeof useGuestTextDraft>;

function TextAlert({ alert }: { alert: GuestUploadState['alert'] }) {
  const t = useTranslations('guestDraft.text');
  if (!alert) return null;
  const message =
    alert === 'too_large'
      ? t('tooLong', LIMITS)
      : alert === 'too_short'
        ? t('tooShort', LIMITS)
        : t('sendError');
  // Signing up does not raise the 20,000 character limit, so no sign-up link here.
  return <CreateQuizErrorAlert message={message} focusOnShow />;
}

interface TextFormProps {
  flow: Flow;
  text: string;
  onTextChange: (text: string) => void;
}

/** Textarea, live counter and submit (UI spec on RIN-1539, section 1). */
function TextForm({ flow, text, onTextChange }: TextFormProps) {
  const t = useTranslations('guestDraft.text');
  const hintId = useId();
  const { state } = flow;
  const sending = state.phase === 'uploading';
  const limit = quizTextLimitState(text);
  return (
    <>
      <TextAlert alert={state.alert} />
      <QuizTextField
        value={text}
        onChange={onTextChange}
        limit={limit}
        hintId={hintId}
        readOnly={sending}
      />
      <Button
        size="lg"
        loading={sending}
        disabled={limit.kind !== 'ok' || sending}
        aria-describedby={hintId}
        onClick={() => void flow.submit(text)}
        className="h-14 w-full sm:w-auto sm:min-w-64"
      >
        {state.alert === 'upload_error' ? t('tryAgain') : t('submit')}
      </Button>
      <p className="text-xs text-neutral-500">{t('privacy')}</p>
    </>
  );
}

function FlowBody({ flow, text, onTextChange }: TextFormProps) {
  const t = useTranslations('guestDraft.text');
  const { state } = flow;
  const { phase } = state;
  if (phase === 'cap') return <GuestDraftCapCard source="text" />;
  if (phase === 'failed') {
    return (
      <GuestDraftFailedCard
        source="text"
        onRetry={() => void flow.submit(text)}
        onChooseAnother={flow.edit}
      />
    );
  }
  if (phase === 'processing' || phase === 'ready') {
    return (
      <GuestDraftProgressCard
        phase={phase}
        source="text"
        label={t('progressLabel', { count: quizTextLimitState(text).count })}
        progress={state.progress}
        pollErrors={state.pollErrors}
        onCancel={flow.cancel}
        onPlayNow={flow.playNow}
      />
    );
  }
  return <TextForm flow={flow} text={text} onTextChange={onTextChange} />;
}

interface GuestTextInputPageProps {
  entry: GuestDraftEntry;
  /** Server-rendered copy under the widget (RIN-1540); the widget stays first on screen. */
  children?: ReactNode;
}

/**
 * `/try/text` (RIN-1539): a signed-out visitor pastes notes, gets up to 10 questions and
 * plays them. The text lives in this component's state only (kept for "Try again" and
 * "Edit text"); it is never shown back outside the textarea, stored or sent to analytics.
 */
export function GuestTextInputPage({ entry, children }: GuestTextInputPageProps) {
  const t = useTranslations('guestDraft.text');
  const flow = useGuestTextDraft(entry);
  const [text, setText] = useState('');

  return (
    <main className="min-h-dvh bg-neutral-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <Pill>{t('badge')}</Pill>
        <h1 className="text-3xl font-bold leading-tight text-neutral-950 lg:text-4xl">
          {t('title')}
        </h1>
        <p className="text-base text-neutral-600">{t('subtitle', LIMITS)}</p>
        <FlowBody flow={flow} text={text} onTextChange={setText} />
        <Link href={SIGN_UP_HREF} className={GUEST_SIGN_UP_LINK_CLASS}>
          {t('higherLimits')}
        </Link>
        {children}
      </div>
    </main>
  );
}
