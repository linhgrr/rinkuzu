'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlinePencilAlt,
  HiOutlineTrash,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useRouter } from '@/i18n/navigation';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { createManualQuizDraft, deleteQuizDraft, listQuizDrafts } from '@/lib/quiz/draftApi';
import { ROUTES } from '@/shared/constants/routes';

export function CreateQuizHubPage() {
  const t = useTranslations('create');
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
  } = useSWR('quiz-drafts-hub', () => listQuizDrafts());
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const handleCreateManual = async () => {
    if (isCreatingManual) return;
    setIsCreatingManual(true);
    try {
      const draft = await createManualQuizDraft({ title: t('untitledQuiz') });
      await mutate((current) => (current ? [draft, ...current] : [draft]), false);
      push(ROUTES.DRAFT.EDIT(draft.id));
    } catch (createError) {
      toast.error(tCommon('error'), {
        description: extractUnknownErrorMessage(createError, t('manualCreateFailed')),
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
        description: extractUnknownErrorMessage(deleteError, t('draftDeleteFailed')),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t('createHubTitle')}
          </h1>
          <p className="mt-3 text-base leading-7 text-neutral-600">{t('createHubDescription')}</p>
        </header>

        <section
          className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2"
          aria-label={t('chooseMethod')}
        >
          <Card className="border-brand-trust/30 bg-green-50/60 shadow-none">
            <CardContent className="flex h-full flex-col p-6 sm:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {t('manualMethodTitle')}
              </h2>
              <p className="mt-2 max-w-md leading-7 text-neutral-600">
                {t('manualMethodDescription')}
              </p>
              <Button
                className="mt-7 w-full justify-center sm:w-fit"
                loading={isCreatingManual}
                onClick={() => void handleCreateManual()}
              >
                {isCreatingManual ? t('creatingDraft') : t('startManual')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-none">
            <CardContent className="flex h-full flex-col p-6 sm:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {t('pdfMethodTitle')}
              </h2>
              <p className="mt-2 max-w-md leading-7 text-neutral-600">
                {t('pdfMethodDescription')}
              </p>
              <Button
                variant="outline"
                className="mt-7 w-full justify-center sm:w-fit"
                onClick={() => push(ROUTES.CREATE_QUIZ_PDF)}
              >
                {t('choosePdf')}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12" aria-labelledby="quiz-drafts-title">
          <div>
            <h2 id="quiz-drafts-title" className="text-2xl font-semibold text-neutral-950">
              {t('yourDrafts')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">{t('yourDraftsDescription')}</p>
          </div>

          {isLoading ? (
            <div className="mt-5 grid gap-3" aria-label={t('loadingDrafts')}>
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-white"
                />
              ))}
            </div>
          ) : error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              <p>{t('draftsLoadFailed')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void mutate()}>
                {tCommon('retry')}
              </Button>
            </div>
          ) : drafts?.length ? (
            <div className="mt-5 grid gap-3">
              {drafts.map((draft) => {
                const canContinue = !['queued', 'processing'].includes(draft.status);
                return (
                  <Card key={draft.id} className="border-neutral-200 bg-white shadow-none">
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {draft.sourceType === 'manual' ? (
                            <HiOutlinePencilAlt className="size-5 shrink-0 text-brand-trust" />
                          ) : (
                            <HiOutlineDocumentText className="size-5 shrink-0 text-neutral-600" />
                          )}
                          <h3 className="truncate font-semibold text-neutral-950">{draft.title}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
                          <span>{t(`draftStatus.${draft.status}`)}</span>
                          <span>{t('draftQuestionCount', { count: draft.questionCount })}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <HiOutlineClock className="size-4" aria-hidden="true" />
                            {dateFormatter.format(new Date(draft.updatedAt))}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          disabled={!canContinue}
                          onClick={() => push(ROUTES.DRAFT.EDIT(draft.id))}
                        >
                          {canContinue ? t('continueEditing') : t('processingDraft')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('deleteDraftNamed', { title: draft.title })}
                          onClick={() => setDraftToDelete(draft.id)}
                          className="text-neutral-500 hover:text-red-600"
                        >
                          <HiOutlineTrash className="size-5" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
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
