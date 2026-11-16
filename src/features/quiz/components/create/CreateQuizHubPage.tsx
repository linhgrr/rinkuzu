'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { HiOutlineArrowRight, HiOutlineClipboardList, HiOutlineCloudUpload } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useRouter } from '@/i18n/navigation';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { createManualQuizDraft, deleteQuizDraft, listQuizDrafts } from '@/lib/quiz/draftApi';
import { DRAFT_SYNC_INTERVAL_MS } from '@/lib/quiz/draftSyncInterval';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { ROUTES } from '@/shared/constants/routes';
import { PublicQuizNotice } from '@/features/quiz/components/PublicQuizNotice';
import { DraftRow, isDraftActive } from '@/features/quiz/components/create/DraftRow';
import { QUIZ_DRAFTS_HUB_KEY } from '@/features/quiz/components/create/quiz-drafts-hub-key';

/**
 * Hero-card action (RIN-1561): `mt-auto` keeps it at the bottom of the card (the content is
 * `h-full` so it fills the stretched grid cell, RIN-1578), `pt-4` is the
 * 16 px floor between the description and the button when the text fills the card.
 * `min-h-56` stays on the cards: it reserves room for the illustration, not equal heights.
 */
const CARD_ACTION_CLASS = 'relative z-10 mt-auto pt-4';

export function CreateQuizHubPage() {
  const t = useTranslations('create');
  const apiErrorMessage = useApiErrorMessage();
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { push } = useRouter();
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    data: drafts,
    error,
    isLoading,
    mutate,
  } = useSWR(QUIZ_DRAFTS_HUB_KEY, () => listQuizDrafts(), {
    // Poll only while a draft is queued or processing, and never in a hidden tab (RIN-1733).
    refreshInterval: (latest) =>
      latest?.some((draft) => isDraftActive(draft.status)) ? DRAFT_SYNC_INTERVAL_MS : 0,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  });
  const [readyAnnouncement, setReadyAnnouncement] = useState('');
  const previousStatuses = useRef<ReadonlyMap<string, QuizDraft['status']>>(new Map());
  // Viewer time zone: the list renders client-side only (SWR), so no hydration pin is needed.
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  // Say so when a draft finishes while the hub is open; the first load announces nothing.
  useEffect(() => {
    if (!drafts) return;
    const before = previousStatuses.current;
    const finished = drafts.filter((draft) => {
      const previous = before.get(draft.id);
      return draft.status === 'completed' && previous !== undefined && isDraftActive(previous);
    });
    previousStatuses.current = new Map(drafts.map((draft) => [draft.id, draft.status]));
    if (finished.length > 0) {
      setReadyAnnouncement(
        finished.map((draft) => t('draftReadyAnnouncement', { title: draft.title })).join(' '),
      );
    }
  }, [drafts, t]);

  const handleCreateManual = async () => {
    if (isCreatingManual) return;
    setIsCreatingManual(true);
    try {
      const draft = await createManualQuizDraft({ title: t('untitledQuiz') });
      await mutate((current) => (current ? [draft, ...current] : [draft]), false);
      push(ROUTES.DRAFT.EDIT(draft.id));
    } catch (createError) {
      toast.error(tCommon('error'), {
        description: apiErrorMessage(createError, t('manualCreateFailed')),
      });
      setIsCreatingManual(false);
    }
  };

  const handleDelete = async () => {
    if (!draftToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuizDraft(draftToDelete);
      await mutate((current) => current?.filter((draft) => draft.id !== draftToDelete), false);
      setDraftToDelete(null);
    } catch (deleteError) {
      toast.error(tCommon('error'), {
        description: apiErrorMessage(deleteError, t('draftDeleteFailed')),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t('createHubTitle')}
          </h1>
        </header>

        <section
          className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-label={t('chooseMethod')}
        >
          <Card
            hover
            className="group overflow-hidden border-brand-trust/20 bg-gradient-to-br from-green-50 via-white to-green-50/40 p-0 shadow-[var(--shadow-sm)] hover:border-brand-trust/35"
          >
            <CardContent className="relative flex h-full min-h-56 flex-col p-4 sm:p-5">
              <div className="relative z-10 w-2/3 pt-1 max-[359px]:w-full xl:w-full xl:pr-20">
                <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
                  {t('manualMethodTitle')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  {t('manualMethodDescription')}
                </p>
              </div>
              <div className={CARD_ACTION_CLASS}>
                <Button
                  className="w-fit"
                  loading={isCreatingManual}
                  onClick={() => void handleCreateManual()}
                >
                  {isCreatingManual ? t('creatingDraft') : t('startManual')}
                  <HiOutlineArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <Image
                src="/images/create-quiz/manual-quiz-illustration.png"
                alt=""
                width={444}
                height={512}
                sizes="(min-width: 1280px) 64px, (min-width: 640px) 160px, 112px"
                className="pointer-events-none absolute right-3 bottom-5 h-auto w-28 select-none transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-1 motion-reduce:transition-none max-[359px]:hidden sm:right-4 sm:w-40 xl:top-6 xl:bottom-auto xl:w-16"
              />
            </CardContent>
          </Card>

          <Card
            hover
            className="group overflow-hidden border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-50/60 p-0 shadow-[var(--shadow-sm)] hover:border-blue-300"
          >
            <CardContent className="relative flex h-full min-h-56 flex-col p-4 sm:p-5">
              <div className="relative z-10 w-2/3 pt-1 max-[359px]:w-full xl:w-full xl:pr-20">
                <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
                  {t('pdfMethodTitle')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  {t('pdfMethodDescription')}
                </p>
              </div>
              <div className={CARD_ACTION_CLASS}>
                <Button
                  variant="outline"
                  className="w-fit bg-white/90"
                  onClick={() => push(ROUTES.CREATE_QUIZ_PDF)}
                >
                  <HiOutlineCloudUpload className="size-4" aria-hidden="true" />
                  {t('choosePdf')}
                </Button>
              </div>
              <Image
                src="/images/create-quiz/pdf-quiz-illustration.png"
                alt=""
                width={413}
                height={512}
                sizes="(min-width: 1280px) 64px, (min-width: 640px) 144px, 112px"
                className="pointer-events-none absolute right-3 bottom-5 h-auto w-28 select-none transition-transform duration-200 group-hover:-translate-y-1 group-hover:-rotate-1 motion-reduce:transition-none max-[359px]:hidden sm:right-5 sm:w-36 xl:top-6 xl:bottom-auto xl:right-4 xl:w-16"
              />
            </CardContent>
          </Card>

          <Card
            hover
            className="group overflow-hidden border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-orange-50/60 p-0 shadow-[var(--shadow-sm)] hover:border-orange-300"
          >
            <CardContent className="relative flex h-full min-h-56 flex-col p-4 sm:p-5">
              <div className="relative z-10 w-full pt-1">
                <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
                  {t('textMethodTitle')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  {t('textMethodDescription')}
                </p>
              </div>
              <div className={CARD_ACTION_CLASS}>
                <Button
                  variant="outline"
                  className="w-fit bg-white/90"
                  onClick={() => push(ROUTES.CREATE_QUIZ_TEXT)}
                >
                  <HiOutlineClipboardList className="size-4" aria-hidden="true" />
                  {t('pasteText')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
        <PublicQuizNotice variant="short" className="mt-3" />

        <section className="mt-10" aria-labelledby="quiz-drafts-title">
          <h2 id="quiz-drafts-title" className="text-2xl font-semibold text-neutral-950">
            {t('yourDrafts')}
          </h2>

          <p role="status" aria-live="polite" className="sr-only">
            {readyAnnouncement}
          </p>

          {isLoading ? (
            <div className="mt-5 grid gap-3" aria-label={t('loadingDrafts')}>
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-xl border border-line bg-white sm:h-24"
                />
              ))}
            </div>
          ) : error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              <p>{t('draftsLoadFailed')}</p>
              <Button variant="outline" className="mt-4" onClick={() => void mutate()}>
                {tCommon('retry')}
              </Button>
            </div>
          ) : drafts?.length ? (
            <div data-testid="quiz-drafts-list" className="mt-5 grid grid-cols-1 gap-3">
              {drafts.map((draft) => (
                <DraftRow
                  key={draft.id}
                  draft={draft}
                  dateFormatter={dateFormatter}
                  onDelete={setDraftToDelete}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-line bg-white p-8 text-center">
              <p className="font-medium text-neutral-800">{t('noDrafts')}</p>
              <p className="mt-1 text-sm text-neutral-500">{t('noDraftsDescription')}</p>
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={draftToDelete !== null}
        title={t('deleteDraftTitle')}
        message={t('deleteDraftDescription')}
        confirmText={tCommon('remove')}
        isLoading={isDeleting}
        onCancel={() => setDraftToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </main>
  );
}
