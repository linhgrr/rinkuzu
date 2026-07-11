'use client';

import { useEffect, useReducer } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';
import { QuestionEditor } from '@/features/quiz/components/editor/QuestionEditor';
import { DraftDesktopOnlyNotice } from '@/features/quiz/components/draft/DraftDesktopOnlyNotice';
import { DraftEditActions } from '@/features/quiz/components/draft/DraftEditActions';
import { DraftEditHeader } from '@/features/quiz/components/draft/DraftEditHeader';
import { DraftPdfPanel } from '@/features/quiz/components/draft/DraftPdfPanel';
import {
  createInitialDraftEditorState,
  draftEditorReducer,
} from '@/features/quiz/lib/draft-editor-state';
import { toQuestionInputs } from '@/features/quiz/lib/question-editor-mutations';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { fetchSubscriptionStatusViewModel } from '@/features/subscription/api/subscription-page-api';
import { extractUnknownErrorMessage } from '@/lib/api/error';
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
  const tCommon = useTranslations('common');
  const { push } = useRouter();
  const { data: session } = useSession();
  const removeDraft = useDraftStore((store) => store.removeDraft);
  const [state, dispatch] = useReducer(
    draftEditorReducer,
    initialDraft,
    createInitialDraftEditorState,
  );

  const { data: subscriptionStatus } = useSWR(
    session?.user?.role === 'admin' ? null : 'subscription-status',
    fetchSubscriptionStatusViewModel,
  );
  const canCreatePrivateQuiz =
    session?.user?.role === 'admin' || subscriptionStatus?.isPremium === true;

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

  const handlePublish = async () => {
    if (state.questions.length === 0) {
      toast.error(t('oneQuestionRequired'));
      return;
    }

    dispatch({ type: 'setSubmitting', value: true });
    try {
      const result = await submitQuizDraft(initialDraft.id, {
        title: state.title,
        folderId: state.selectedFolderId,
        description: state.description,
        questions: toQuestionInputs(state.questions),
        isPrivate: state.isPrivate,
      });
      removeDraft(initialDraft.id);
      toast.success(t('publishSuccess'));
      push(ROUTES.QUIZ.VIEW(result.slug));
    } catch (error: unknown) {
      toast.error(tCommon('error'), {
        description: extractUnknownErrorMessage(error, t('publishFailed')),
      });
      dispatch({ type: 'setSubmitting', value: false });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <DraftDesktopOnlyNotice
        title={t('desktopOnlyTitle')}
        description={t('desktopOnlyDescription')}
        backHomeLabel={t('backHome')}
      />

      <div className="hidden md:flex">
        <div
          className={`transition-[width] duration-300 ${
            state.showPDFViewer && pdfUrl ? 'w-1/2' : 'w-full'
          }`}
        >
          <div className="mx-auto max-w-4xl px-6 py-8">
            <DraftEditHeader
              title={t('editDraftTitle')}
              questionsLabel={t('questionsExtracted', { count: state.questions.length })}
              backLabel={tCommon('back')}
            />

            <QuizMetaForm
              title={state.title}
              onTitleChange={(value) => dispatch({ type: 'setTitle', value })}
              description={state.description}
              onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
              selectedFolderId={state.selectedFolderId}
              onFolderChange={(value) => dispatch({ type: 'setSelectedFolder', value })}
              labels={{
                title: t('quizTitle'),
                titlePlaceholder: t('enterTitle'),
                description: t('descriptionOptional'),
                descriptionPlaceholder: t('provideContext'),
                folder: t('folderLabel'),
                privateLabel: t('privateQuiz'),
                privateDescription: t('privateQuizDescription'),
              }}
              isPrivate={canCreatePrivateQuiz ? state.isPrivate : undefined}
              onPrivateChange={
                canCreatePrivateQuiz
                  ? (value) => dispatch({ type: 'setIsPrivate', value })
                  : undefined
              }
              disabled={state.isSubmitting}
            />

            <QuestionEditor
              questions={state.questions}
              canEdit
              questionToRemove={state.questionToRemove}
              onUpdateField={(index, field, value) =>
                dispatch({ type: 'updateQuestionField', index, field, value })
              }
              onUpdateOption={(questionIndex, optionIndex, value) =>
                dispatch({ type: 'updateOption', questionIndex, optionIndex, value })
              }
              onUpdateQuestionImage={(questionIndex, url) =>
                dispatch({ type: 'updateQuestionImage', questionIndex, value: url })
              }
              onRemoveQuestionImage={(questionIndex) =>
                dispatch({ type: 'updateQuestionImage', questionIndex, value: undefined })
              }
              onUpdateOptionImage={(questionIndex, optionIndex, url) =>
                dispatch({
                  type: 'updateOptionImage',
                  questionIndex,
                  optionIndex,
                  value: url,
                })
              }
              onRemoveOptionImage={(questionIndex, optionIndex) =>
                dispatch({
                  type: 'updateOptionImage',
                  questionIndex,
                  optionIndex,
                  value: undefined,
                })
              }
              onAddQuestion={() => dispatch({ type: 'addQuestion' })}
              onRemoveQuestion={(index) => dispatch({ type: 'removeQuestion', index })}
              onToggleType={(index, type) =>
                dispatch({ type: 'toggleQuestionType', index, value: type })
              }
              onSetSingleCorrect={(questionIndex, optionIndex) =>
                dispatch({ type: 'setSingleCorrect', questionIndex, optionIndex })
              }
              onToggleMultipleCorrect={(questionIndex, optionIndex, checked) =>
                dispatch({
                  type: 'toggleMultipleCorrect',
                  questionIndex,
                  optionIndex,
                  checked,
                })
              }
              onSetQuestionToRemove={(value) => dispatch({ type: 'setQuestionToRemove', value })}
            />

            <div className="mt-6">
              <DraftEditActions
                hasPdf={Boolean(pdfUrl)}
                showPdfViewer={state.showPDFViewer}
                isSubmitting={state.isSubmitting}
                canSubmit={state.questions.length > 0}
                onTogglePdf={() => dispatch({ type: 'togglePdfViewer' })}
                onCancel={() => push(ROUTES.DASHBOARD)}
                onSubmit={() => {
                  void handlePublish();
                }}
                labels={{
                  hidePdf: t('hidePDFReference'),
                  showPdf: t('showPDFReference'),
                  cancel: tCommon('cancel'),
                  submit: t('publishQuiz'),
                  submitting: t('publishingQuiz'),
                }}
              />
            </div>
          </div>
        </div>

        {state.showPDFViewer && pdfUrl ? (
          <DraftPdfPanel
            pdfUrl={pdfUrl}
            pdfDataUrl={pdfDataUrl}
            onClose={() => dispatch({ type: 'setShowPDFViewer', value: false })}
          />
        ) : null}
      </div>
    </div>
  );
}
