'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { QuizEditorWorkspace } from '@/features/quiz/components/editor/QuizEditorWorkspace';
import { Button } from '@/components/ui/Button';
import { useQuizDraftAutosave } from '@/features/quiz/hooks/useQuizDraftAutosave';
import { toEditorQuestions } from '@/features/quiz/lib/question-editor-mutations';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { createPdfObjectUrlFromUrl } from '@/lib/pdf';
import { submitQuizDraft } from '@/lib/quiz/draftApi';
import { ROUTES } from '@/shared/constants/routes';
import { useDraftStore } from '@/store/useDraftStore';

interface DraftEditPageProps {
  initialDraft: QuizDraft;
  pdfUrl?: string;
}

export function DraftEditPage({ initialDraft, pdfUrl }: DraftEditPageProps) {
  const t = useTranslations('create');
  const apiErrorMessage = useApiErrorMessage();
  const tCommon = useTranslations('common');
  const { data: session } = useSession();
  const { push } = useRouter();
  const removeDraft = useDraftStore((store) => store.removeDraft);
  const [restoredPayload, setRestoredPayload] = useState<
    ReturnType<typeof toInitialAutosavePayload> | undefined
  >();
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [rightsAttested, setRightsAttested] = useState(false);
  const autosave = useQuizDraftAutosave(initialDraft.id, initialDraft.revision);
  const isManualDraft = initialDraft.sourceType === 'manual';

  const { data: pdfDataUrl } = useSWR(
    pdfUrl ? (['draft-edit-pdf', pdfUrl] as const) : null,
    async ([, url]) => createPdfObjectUrlFromUrl(url),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    return () => {
      if (pdfDataUrl) URL.revokeObjectURL(pdfDataUrl);
    };
  }, [pdfDataUrl]);

  const serverQuestions = toEditorQuestions(initialDraft.questions, 'draft');
  const initialQuestions = restoredPayload
    ? toEditorQuestions(restoredPayload.questions, 'recovery')
    : serverQuestions;

  const editor = (
    <QuizEditorWorkspace
      key={`${initialDraft.id}:${workspaceVersion}`}
      initial={{
        title: restoredPayload?.title ?? initialDraft.title,
        description: restoredPayload?.description ?? initialDraft.description,
        selectedFolderId: restoredPayload?.selectedFolderId ?? initialDraft.folderId ?? null,
        submitToPremium: restoredPayload?.submitToPremium ?? initialDraft.submitToPremium,
        questions: initialQuestions,
      }}
      {...(pdfUrl !== undefined ? { pdfUrl } : {})}
      {...(pdfDataUrl !== undefined ? { pdfDataUrl } : {})}
      pdfLayout="flush"
      canEdit
      showPremiumToggle
      premiumEligible={session?.user?.emailVerified === true}
      premiumAttestation={{ checked: rightsAttested, onChange: setRightsAttested }}
      requireQuestions
      headerExtra={
        <span className="text-sm text-neutral-500" aria-live="polite">
          {autosave.status === 'saving'
            ? t('autosaveSaving')
            : autosave.status === 'dirty'
              ? t('autosavePending')
              : autosave.status === 'saved'
                ? t('autosaveSaved')
                : autosave.status === 'error'
                  ? t('autosaveOffline')
                  : null}
        </span>
      }
      banner={
        autosave.recovery || autosave.status === 'conflict' ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <span>
              {autosave.status === 'conflict' ? t('autosaveConflict') : t('recoveryAvailable')}
            </span>
            <div className="flex gap-2">
              {autosave.status === 'conflict' ? (
                <Button type="button" size="sm" onClick={() => window.location.reload()}>
                  {t('reloadLatest')}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const recovered = autosave.restoreRecovery();
                      if (!recovered) return;
                      setRestoredPayload(toInitialAutosavePayload(recovered));
                      setWorkspaceVersion((version) => version + 1);
                    }}
                  >
                    {t('restoreDraft')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autosave.discardRecovery}
                  >
                    {t('discardRecovery')}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : undefined
      }
      labels={{
        pageTitle: isManualDraft ? t('manualEditorTitle') : t('editDraftTitle'),
        questionsCount: (count) =>
          isManualDraft ? t('questionsInDraft', { count }) : t('questionsExtracted', { count }),
        metaTitle: t('quizTitle'),
        metaDescription: isManualDraft ? t('manualEditorDescription') : t('draftEditorDescription'),
        title: t('quizTitle'),
        titlePlaceholder: t('enterTitle'),
        description: t('descriptionOptional'),
        descriptionPlaceholder: t('provideContext'),
        folder: t('folderLabel'),
        premiumLabel: t('premiumQuiz'),
        premiumDescription: t('premiumQuizDescription'),
        premiumRightsLabel: t('premiumRightsLabel'),
        premiumRightsDescription: t('premiumRightsDescription'),
        premiumVerificationRequired: t('premiumVerificationRequired'),
        verifyEmailCta: t('verifyEmailCta'),
        cancel: tCommon('cancel'),
        submit: t('publishQuiz'),
        submitting: t('publishingQuiz'),
        premiumSubmit: t('submitPremiumQuiz'),
        premiumSubmitting: t('submittingPremiumQuiz'),
        hidePdf: t('hidePDFReference'),
        showPdf: t('showPDFReference'),
        validationTitle: t('validationTitle'),
        invalidQuestions: (numbers) => t('invalidQuestions', { numbers }),
      }}
      onChange={autosave.queueSave}
      onCancel={() => {
        void autosave.flush().finally(() => push(ROUTES.CREATE_QUIZ));
      }}
      onSubmit={async (payload) => {
        if (payload.questions.length === 0) {
          toast.error(t('oneQuestionRequired'));
          throw new Error('no_questions');
        }
        if (autosave.status === 'conflict') {
          toast.error(t('autosaveConflict'));
          throw new Error('draft_conflict');
        }
        await autosave.flush();
        try {
          const result = await submitQuizDraft(initialDraft.id, {
            title: payload.title,
            folderId: payload.selectedFolderId,
            description: payload.description,
            questions: payload.questions,
            submitToPremium: payload.submitToPremium,
            ...(payload.submitToPremium ? { rightsAttested: true } : {}),
          });
          autosave.discardRecovery();
          removeDraft(initialDraft.id);
          toast.success(t('publishSuccess'));
          push(ROUTES.QUIZ.VIEW(result.slug));
        } catch (error: unknown) {
          toast.error(tCommon('error'), {
            description: apiErrorMessage(error, t('publishFailed')),
          });
          throw error;
        }
      }}
    />
  );

  return <div className="min-h-[100dvh] bg-neutral-50">{editor}</div>;
}

function toInitialAutosavePayload(payload: {
  title: string;
  description: string;
  selectedFolderId: string | null;
  submitToPremium: boolean;
  questions: QuizDraft['questions'];
}) {
  return payload;
}
