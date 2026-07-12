'use client';

import { useReducer, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineDocumentText,
  HiOutlineEyeOff,
  HiOutlinePencilAlt,
  HiOutlineSave,
  HiOutlineTrash,
} from 'react-icons/hi';
import QuizMetaForm from '@/features/quiz/components/QuizMetaForm';
import { QuestionEditor } from '@/features/quiz/components/editor/QuestionEditor';
import {
  createQuizEditorWorkspaceState,
  quizEditorWorkspaceReducer,
  type QuizEditorWorkspaceState,
} from '@/features/quiz/lib/quiz-editor-workspace-state';
import { toQuestionInputs } from '@/features/quiz/lib/question-editor-mutations';
import type {
  QuizEditorQuestionInputViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';

const PDFViewer = dynamic(() => import('@/features/quiz/components/PDFViewer'), { ssr: false });

/**
 * Payload shape matches BE DTOs:
 * - submit draft: submitQuizDraftRequestSchema.questions (questionListSchema)
 * - update quiz: updateQuizRequestSchema.questions (questionListSchema)
 * No editorId / client-only fields — see toQuestionInputs().
 */
export type QuizEditorWorkspaceSubmitPayload = {
  title: string;
  description: string;
  selectedFolderId: string | null;
  isPrivate: boolean;
  /** API-ready questions (single | multiple + optional images). */
  questions: QuizEditorQuestionInputViewModel[];
};

export type QuizEditorWorkspaceLabels = {
  pageTitle: string;
  pageSubtitle?: string;
  questionsCount: (count: number) => string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  titlePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  folder: string;
  privateLabel: string;
  privateDescription: string;
  cancel: string;
  submit: string;
  submitting: string;
  hidePdf: string;
  showPdf: string;
  /** Published edit only */
  delete?: string;
  deleting?: string;
};

type QuizEditorWorkspaceProps = {
  initial: {
    title: string;
    description?: string | null;
    selectedFolderId?: string | null;
    isPrivate?: boolean;
    questions: QuizEditorQuestionViewModel[];
  };
  pdfUrl?: string | null;
  pdfDataUrl?: string | null;
  /** draft = flush side panel; published = card panel (existing edit chrome) */
  pdfLayout?: 'flush' | 'card';
  canEdit: boolean;
  showPrivateToggle: boolean;
  labels: QuizEditorWorkspaceLabels;
  statusError?: string;
  statusSuccess?: string;
  /** Require ≥1 question on submit (draft publish). */
  requireQuestions?: boolean;
  onSubmit: (payload: QuizEditorWorkspaceSubmitPayload) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  footerExtra?: ReactNode;
  metaExtra?: ReactNode;
  banner?: ReactNode;
};

function WorkspacePdfPanel({
  layout,
  pdfUrl,
  pdfDataUrl,
  onClose,
}: {
  layout: 'flush' | 'card';
  pdfUrl: string;
  pdfDataUrl?: string | null;
  onClose: () => void;
}) {
  if (layout === 'flush') {
    return (
      <aside className="sticky top-0 h-screen w-1/2 border-l border-neutral-200 bg-white p-4">
        <PDFViewer
          pdfDataUrl={pdfDataUrl || null}
          pdfUrl={pdfUrl}
          onClose={onClose}
          showHeader={false}
        />
      </aside>
    );
  }

  return (
    <div className="hidden lg:block lg:w-1/2 lg:pl-4">
      <div className="sticky top-24 h-[calc(100vh-6rem)]">
        <Card className="flex h-full flex-col border-2 border-green-200 bg-white shadow-2xl">
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
            <PDFViewer pdfDataUrl={pdfDataUrl || null} pdfUrl={pdfUrl} onClose={onClose} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function QuizEditorWorkspace({
  initial,
  pdfUrl,
  pdfDataUrl,
  pdfLayout = 'card',
  canEdit,
  showPrivateToggle,
  labels,
  statusError,
  statusSuccess,
  requireQuestions = false,
  onSubmit,
  onCancel,
  onDelete,
  isDeleting = false,
  footerExtra,
  metaExtra,
  banner,
}: QuizEditorWorkspaceProps) {
  const [state, dispatch] = useReducer(
    quizEditorWorkspaceReducer,
    undefined,
    (): QuizEditorWorkspaceState =>
      createQuizEditorWorkspaceState({
        questions: initial.questions,
        title: initial.title,
        description: initial.description,
        isPrivate: initial.isPrivate,
        selectedFolderId: initial.selectedFolderId,
        showPDFViewer: Boolean(pdfUrl),
      }),
  );

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canEdit || state.isSubmitting) return;

    // Validation + API live in adapters (draft publish vs published save).
    dispatch({ type: 'setSubmitting', value: true });
    try {
      await onSubmit({
        title: state.title.trim(),
        description: state.description.trim(),
        selectedFolderId: state.selectedFolderId,
        isPrivate: state.isPrivate,
        questions: toQuestionInputs(state.questions),
      });
    } catch {
      dispatch({ type: 'setSubmitting', value: false });
    }
  };

  const showPdf = Boolean(pdfUrl && state.showPDFViewer);
  const formColumnClass =
    pdfLayout === 'flush'
      ? showPdf
        ? 'w-1/2'
        : 'w-full'
      : showPdf
        ? 'lg:w-1/2 lg:pr-4'
        : 'w-full';

  return (
    <div className="flex min-h-screen transition-[width] duration-300">
      <div className={`transition-[width,padding] duration-300 ${formColumnClass}`}>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {banner}

          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">{labels.pageTitle}</h1>
              {labels.pageSubtitle ? (
                <p className="mt-2 text-neutral-600">{labels.pageSubtitle}</p>
              ) : (
                <p className="mt-2 text-neutral-600">
                  {labels.questionsCount(state.questions.length)}
                </p>
              )}
            </div>
            {pdfUrl ? (
              <Button
                type="button"
                onClick={() => dispatch({ type: 'togglePdfViewer' })}
                variant="outline"
                className="flex shrink-0 items-center gap-2 border-green-200 text-brand-trust hover:bg-green-50"
              >
                {state.showPDFViewer ? (
                  <>
                    <HiOutlineEyeOff className="size-4" /> {labels.hidePdf}
                  </>
                ) : (
                  <>
                    <HiOutlineDocumentText className="size-4" /> {labels.showPdf}
                  </>
                )}
              </Button>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-6"
          >
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HiOutlinePencilAlt className="size-5 text-brand-trust" />
                  {labels.metaTitle}
                </CardTitle>
                <CardDescription>{labels.metaDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {statusError ? (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{statusError}</div>
                  </div>
                ) : null}
                {statusSuccess ? (
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="text-sm text-green-700">{statusSuccess}</div>
                  </div>
                ) : null}

                <QuizMetaForm
                  title={state.title}
                  onTitleChange={(value) => dispatch({ type: 'setTitle', value })}
                  description={state.description}
                  onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
                  selectedFolderId={state.selectedFolderId}
                  onFolderChange={(value) => dispatch({ type: 'setSelectedFolder', value })}
                  labels={{
                    title: labels.title,
                    titlePlaceholder: labels.titlePlaceholder,
                    description: labels.description,
                    descriptionPlaceholder: labels.descriptionPlaceholder,
                    folder: labels.folder,
                    privateLabel: labels.privateLabel,
                    privateDescription: labels.privateDescription,
                  }}
                  isPrivate={showPrivateToggle ? state.isPrivate : undefined}
                  onPrivateChange={
                    showPrivateToggle
                      ? (value) => dispatch({ type: 'setIsPrivate', value })
                      : undefined
                  }
                  disabled={!canEdit || state.isSubmitting}
                />
                {metaExtra}
              </CardContent>
            </Card>

            <QuestionEditor
              questions={state.questions}
              canEdit={canEdit && !state.isSubmitting}
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

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={state.isSubmitting}
                >
                  {labels.cancel}
                </Button>
                {canEdit ? (
                  <Button
                    type="submit"
                    loading={state.isSubmitting}
                    disabled={
                      !state.title.trim() ||
                      (requireQuestions && state.questions.length === 0) ||
                      isDeleting
                    }
                    className="flex items-center gap-2"
                  >
                    {state.isSubmitting ? (
                      labels.submitting
                    ) : (
                      <>
                        <HiOutlineSave className="size-4" />
                        {labels.submit}
                      </>
                    )}
                  </Button>
                ) : null}
              </div>

              {canEdit && onDelete && labels.delete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  loading={isDeleting}
                  disabled={state.isSubmitting}
                  className="flex items-center gap-2"
                >
                  <HiOutlineTrash className="size-4" />
                  {isDeleting && labels.deleting ? labels.deleting : labels.delete}
                </Button>
              ) : null}
            </div>
          </form>

          {footerExtra}
        </div>
      </div>

      {showPdf && pdfUrl ? (
        <WorkspacePdfPanel
          layout={pdfLayout}
          pdfUrl={pdfUrl}
          pdfDataUrl={pdfDataUrl}
          onClose={() => dispatch({ type: 'setShowPDFViewer', value: false })}
        />
      ) : null}
    </div>
  );
}
