'use client';

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { HiOutlineArrowLeft, HiOutlineExclamationCircle, HiOutlineTag } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { GuestDraftProgressCard } from '@/features/guest-draft/components/GuestDraftProgressCard';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import { getCreateQuizDraftErrorMessage } from '@/features/quiz/components/create/create-quiz-draft-error';
import { QUIZ_DRAFTS_HUB_KEY } from '@/features/quiz/components/create/quiz-drafts-hub-key';
import { PublicQuizNotice } from '@/features/quiz/components/PublicQuizNotice';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { QuizPhotoPicker } from '@/features/quiz-images/components/QuizPhotoPicker';
import { useQuizPhotos } from '@/features/quiz-images/hooks/useQuizPhotos';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiResponseError } from '@/lib/api/client';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { createImageQuizDraft } from '@/lib/quiz/draftApi';
import { ROUTES } from '@/shared/constants/routes';
import { useDraftStore } from '@/store/useDraftStore';

const MB = 1024 * 1024;
/** Same cap as a draft title elsewhere in the create flow. */
const TITLE_MAX_LENGTH = 120;
const PASTE_TEXT_LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

type Translator = ReturnType<typeof useTranslations<'create'>>;
type ApiErrorMessage = ReturnType<typeof useApiErrorMessage>;

/**
 * Why the draft was not made. `too_little_text` (422: nothing was created and no quota used)
 * and `unavailable` (503: the text recognition is paused or down) have their own copy and a
 * link to the paste-text page; everything else reads like the PDF flow, a quota refusal
 * included (it also opens the upgrade modal through the API error events). A failed fetch
 * (offline) is a send error. A cancel is no error at all.
 */
type PhotoFailure =
  | { kind: 'too_little_text' }
  | { kind: 'unavailable' }
  | { kind: 'send_error' }
  | { kind: 'message'; message: string };

function classifyFailure(
  error: unknown,
  t: Translator,
  apiErrorMessage: ApiErrorMessage,
): PhotoFailure {
  if (error instanceof ApiResponseError) {
    if (error.status === 422 && error.code === 'too_little_text') {
      return { kind: 'too_little_text' } as const;
    }
    if (error.status === 503) return { kind: 'unavailable' } as const;
    return { kind: 'message', message: getCreateQuizDraftErrorMessage(error, t, apiErrorMessage) };
  }
  return { kind: 'send_error' } as const;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** 503: no retry, it would hit the same wall; the photos are dropped (UI spec RIN-1791, 4). */
function PhotoUnavailableCard() {
  const t = useTranslations('create.photo');
  return (
    <Card variant="bordered" role="alert" className="space-y-4 border-red-200 bg-red-50 p-5 sm:p-6">
      <div className="flex items-start gap-3 text-red-700">
        <HiOutlineExclamationCircle className="mt-0.5 size-6 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold">{t('unavailableTitle')}</h2>
          <p className="mt-1 text-sm">{t('unavailableBody')}</p>
        </div>
      </div>
      <Link href={ROUTES.CREATE_QUIZ_TEXT} className="btn btn-primary w-full sm:w-auto">
        {t('pasteTextLink')}
      </Link>
    </Card>
  );
}

/** The set-level alert above the photos; the photos stay so one can be retaken. */
function PhotoAlert({ failure }: { failure: PhotoFailure | null }) {
  const t = useTranslations('create.photo');
  if (!failure || failure.kind === 'unavailable') return null;
  if (failure.kind === 'too_little_text') {
    return (
      <div className="space-y-1">
        <CreateQuizErrorAlert message={t('tooLittleText')} focusOnShow />
        <Link href={ROUTES.CREATE_QUIZ_TEXT} className={PASTE_TEXT_LINK_CLASS}>
          {t('pasteTextLink')}
        </Link>
      </div>
    );
  }
  return (
    <CreateQuizErrorAlert
      message={failure.kind === 'send_error' ? t('sendError') : failure.message}
      focusOnShow
    />
  );
}

/**
 * Signed-in `/create/photo` (RIN-1794, UI spec RIN-1791): a title and 1-5 photos (taken or
 * picked, prepared in the browser by the shared picker, RIN-1793) become a draft that lands
 * in the normal draft review, as a text draft does. The API reads the text in the photos
 * before it creates anything, so the wait shows the guest "reading" card with a cancel.
 * Laid out like `/create/text`. The photos live in this page's state only and are never
 * stored, put in a URL or sent to analytics.
 */
export function CreatePhotoQuizPage() {
  const t = useTranslations('create');
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();
  const { push } = useRouter();
  const { addDraft } = useDraftStore();
  const { mutate } = useSWRConfig();
  const photos = useQuizPhotos('create_photo');
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<PhotoFailure | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const unavailable = failure?.kind === 'unavailable';

  // A paused feature keeps nothing: the photos are dropped, not just hidden.
  const dropPhotos = useEffectEvent(photos.clear);
  const holdsPhotos = photos.photos.length > 0;
  useEffect(() => {
    if (unavailable && holdsPhotos) dropPhotos();
  }, [unavailable, holdsPhotos]);

  // Leaving the page cancels a read in flight; nothing was created yet.
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async () => {
    if (sending || !photos.canSubmit) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setFailure(null);
    const draftTitle = title.trim() || t('untitledQuiz');
    try {
      const draft = await createImageQuizDraft(
        { title: draftTitle, images: photos.blobs },
        { signal: controller.signal },
      );
      addDraft({
        id: draft.id,
        title: draftTitle,
        status: 'processing',
        chunksTotal: 1,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      });
      // The hub may still hold its list from before this page; show the new draft at once.
      await mutate<QuizDraft[]>(
        QUIZ_DRAFTS_HUB_KEY,
        (current) => [draft, ...(current ?? []).filter((item) => item.id !== draft.id)],
        { revalidate: false },
      );
      toast.success(t('processingStarted'));
      push(ROUTES.CREATE_QUIZ);
    } catch (error: unknown) {
      setSending(false);
      if (!isAbort(error)) setFailure(classifyFailure(error, t, apiErrorMessage));
    }
  };

  const handleTitleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const retry = failure !== null && failure.kind !== 'unavailable';

  return (
    <main className="min-h-[100dvh] bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={ROUTES.CREATE_QUIZ}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950"
        >
          <HiOutlineArrowLeft className="size-4" aria-hidden="true" />
          {t('createHubTitle')}
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t('photo.title')}
          </h1>
          <p className="text-base text-neutral-600">{t('photo.subtitle')}</p>
        </header>

        {unavailable ? (
          <PhotoUnavailableCard />
        ) : (
          <>
            <form onSubmit={handleTitleSubmit}>
              <Input
                label={t('photo.quizTitle')}
                id="photo-quiz-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('untitledQuiz')}
                maxLength={TITLE_MAX_LENGTH}
                readOnly={sending}
                icon={<HiOutlineTag className="size-5" />}
              />
            </form>
            {sending ? (
              <GuestDraftProgressCard
                phase="uploading"
                source="image"
                label={t('photo.progressLabel', {
                  count: photos.readyCount,
                  size: format.number(photos.totalBytes / MB, { maximumFractionDigits: 1 }),
                })}
                progress={null}
                pollErrors={0}
                onCancel={() => abortRef.current?.abort()}
                onPlayNow={() => undefined}
              />
            ) : (
              <QuizPhotoPicker
                photos={photos}
                alert={<PhotoAlert failure={failure} />}
                submit={{
                  label: retry ? t('photo.tryAgain') : t('photo.submit'),
                  loading: false,
                  onClick: () => void submit(),
                }}
              />
            )}
          </>
        )}
        <PublicQuizNotice variant="short" />
      </div>
    </main>
  );
}
