'use client';

import { useReducer, useState, type ReactNode } from 'react';
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
  type QuizEditorWorkspaceAction,
  type QuizEditorWorkspaceState,
} from '@/features/quiz/lib/quiz-editor-workspace-state';
import { toQuestionInputs } from '@/features/quiz/lib/question-editor-mutations';
import { questionListSchema } from '@/lib/validation/question';
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
  submitToPremium: boolean;
  /** API-ready questions (single | multiple + optional images). */
  questions: QuizEditorQuestionInputViewModel[];
};

type QuizEditorWorkspaceLabels = {
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
  premiumLabel: string;
  premiumDescription: string;
  premiumRightsLabel?: string;
  premiumRightsDescription?: string;
  premiumVerificationRequired?: string;
  verifyEmailCta?: string;
  cancel: string;
  submit: string;
  submitting: string;
  premiumSubmit?: string;
  premiumSubmitting?: string;
  hidePdf: string;
  showPdf: string;
  validationTitle?: string;
  invalidQuestions?: (numbers: string) => string;
  /** Published edit only */
  delete?: string;
  deleting?: string;
};

type QuizEditorWorkspaceProps = {
  initial: {
    title: string;
    description?: string | null;
    selectedFolderId?: string | null;
    submitToPremium?: boolean;
    questions: QuizEditorQuestionViewModel[];
  };
  pdfUrl?: string | null;
  pdfDataUrl?: string | null;
  /** draft = flush side panel; published = card panel (existing edit chrome) */
  pdfLayout?: 'flush' | 'card';
  canEdit: boolean;
  showPremiumToggle: boolean;
  premiumEligible?: boolean;
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
  /** Rendered inside the meta form, right above the Premium choice (RIN-1339). */
  metaNotice?: ReactNode;
  banner?: ReactNode;
  headerExtra?: ReactNode;
  onChange?: (payload: QuizEditorWorkspaceSubmitPayload) => void;
  premiumAttestation?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
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
      <aside className="fixed inset-0 z-50 h-[100dvh] bg-white p-3 lg:sticky lg:top-0 lg:z-auto lg:w-1/2 lg:border-l lg:border-neutral-200 lg:p-4">
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
  showPremiumToggle,
  premiumEligible = true,
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
  metaNotice,
  banner,
  headerExtra,
  onChange,
  premiumAttestation,
}: QuizEditorWorkspaceProps) {
  const [state, dispatch] = useReducer(
    quizEditorWorkspaceReducer,
    undefined,
    (): QuizEditorWorkspaceState =>
      createQuizEditorWorkspaceState({
        questions: initial.questions,
        title: initial.title,
        ...(initial.description !== undefined ? { description: initial.description } : {}),
        ...(initial.submitToPremium !== undefined
          ? { submitToPremium: initial.submitToPremium }
          : {}),
        ...(initial.selectedFolderId !== undefined
          ? { selectedFolderId: initial.selectedFolderId }
          : {}),
        showPDFViewer: Boolean(pdfUrl),
      }),
  );
  const [hasValidationError, setHasValidationError] = useState(false);
  const [invalidQuestionIndexes, setInvalidQuestionIndexes] = useState<number[]>([]);
  const dispatchEditorAction = (action: QuizEditorWorkspaceAction) => {
    const nextState = quizEditorWorkspaceReducer(state, action);
    dispatch(action);
    onChange?.({
      title: nextState.title,
      description: nextState.description,
      selectedFolderId: nextState.selectedFolderId,
      submitToPremium: nextState.submitToPremium,
      questions: toQuestionInputs(nextState.questions),
    });
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canEdit || state.isSubmitting) return;

    const questions = toQuestionInputs(state.questions);
    const validation = questionListSchema.safeParse(questions);
    if (!validation.success) {
      setHasValidationError(true);
      const indexes = Array.from(
        new Set(
          validation.error.issues
            .map((issue) => issue.path[0])
            .filter((value): value is number => typeof value === 'number'),
        ),
      );
      setInvalidQuestionIndexes(indexes);
      const firstInvalid = indexes[0];
      if (firstInvalid !== undefined) {
        document.getElementById(`quiz-question-${firstInvalid}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
      return;
    }

    setHasValidationError(false);
    setInvalidQuestionIndexes([]);
    dispatch({ type: 'setSubmitting', value: true });
    try {
      await onSubmit({
        title: state.title.trim(),
        description: state.description.trim(),
        selectedFolderId: state.selectedFolderId,
        submitToPremium: state.submitToPremium,
        questions,
      });
    } catch {
      dispatch({ type: 'setSubmitting', value: false });
    }
  };

  const showPdf = Boolean(pdfUrl && state.showPDFViewer);
  const formColumnClass =
    pdfLayout === 'flush'
      ? showPdf
        ? 'w-full lg:w-1/2'
        : 'w-full'
      : showPdf
        ? 'lg:w-1/2 lg:pr-4'
        : 'w-full';

  return (
    <div className="flex min-h-[100dvh]">
      <div className={formColumnClass}>
        <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6 md:pb-28">
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
            <div className="flex shrink-0 items-center gap-3">
              {headerExtra}
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
                  onTitleChange={(value) => dispatchEditorAction({ type: 'setTitle', value })}
                  description={state.description}
                  onDescriptionChange={(value) =>
                    dispatchEditorAction({ type: 'setDescription', value })
                  }
                  selectedFolderId={state.selectedFolderId}
                  onFolderChange={(value) =>
                    dispatchEditorAction({ type: 'setSelectedFolder', value })
                  }
                  labels={{
                    title: labels.title,
                    titlePlaceholder: labels.titlePlaceholder,
                    description: labels.description,
                    descriptionPlaceholder: labels.descriptionPlaceholder,
                    folder: labels.folder,
                    premiumLabel: labels.premiumLabel,
                    premiumDescription: labels.premiumDescription,
                    premiumRightsLabel: labels.premiumRightsLabel,
                    premiumRightsDescription: labels.premiumRightsDescription,
                  }}
                  {...(showPremiumToggle ? { submitToPremium: state.submitToPremium } : {})}
                  premiumEligible={premiumEligible}
                  premiumEligibilityMessage={labels.premiumVerificationRequired}
                  premiumEligibilityCta={labels.verifyEmailCta}
                  {...(showPremiumToggle
                    ? {
                        onPremiumChange: (value: boolean) =>
                          dispatchEditorAction({ type: 'setSubmitToPremium', value }),
                        ...(premiumAttestation === undefined
                          ? {}
                          : {
                              premiumRightsAttested: premiumAttestation.checked,
                              onPremiumRightsChange: premiumAttestation.onChange,
                            }),
                      }
                    : {})}
                  disabled={!canEdit || state.isSubmitting}
                  notice={metaNotice}
                />
                {metaExtra}
              </CardContent>
            </Card>

            <QuestionEditor
              questions={state.questions}
              canEdit={canEdit && !state.isSubmitting}
              questionToRemove={state.questionToRemove}
              onUpdateField={(index, field, value) =>
                dispatchEditorAction({ type: 'updateQuestionField', index, field, value })
              }
              onUpdateOption={(questionIndex, optionIndex, value) =>
                dispatchEditorAction({ type: 'updateOption', questionIndex, optionIndex, value })
              }
              onAddOption={(questionIndex) =>
                dispatchEditorAction({ type: 'addOption', questionIndex })
              }
              onRemoveOption={(questionIndex, optionIndex) =>
                dispatchEditorAction({ type: 'removeOption', questionIndex, optionIndex })
              }
              onUpdateQuestionImage={(questionIndex, url) =>
                dispatchEditorAction({ type: 'updateQuestionImage', questionIndex, value: url })
              }
              onRemoveQuestionImage={(questionIndex) =>
                dispatchEditorAction({ type: 'updateQuestionImage', questionIndex })
              }
              onUpdateOptionImage={(questionIndex, optionIndex, url) =>
                dispatchEditorAction({
                  type: 'updateOptionImage',
                  questionIndex,
                  optionIndex,
                  value: url,
                })
              }
              onRemoveOptionImage={(questionIndex, optionIndex) =>
                dispatchEditorAction({
                  type: 'updateOptionImage',
                  questionIndex,
                  optionIndex,
                })
              }
              onAddQuestion={() =>
                dispatchEditorAction({
                  type: 'addQuestion',
                  editorId: `q-new-${crypto.randomUUID()}`,
                })
              }
              onInsertQuestion={(index) =>
                dispatchEditorAction({
                  type: 'insertQuestion',
                  index,
                  editorId: `q-new-${crypto.randomUUID()}`,
                })
              }
              onRemoveQuestion={(index) => dispatchEditorAction({ type: 'removeQuestion', index })}
              onToggleType={(index, type) =>
                dispatchEditorAction({ type: 'toggleQuestionType', index, value: type })
              }
              onSetSingleCorrect={(questionIndex, optionIndex) =>
                dispatchEditorAction({ type: 'setSingleCorrect', questionIndex, optionIndex })
              }
              onToggleMultipleCorrect={(questionIndex, optionIndex, checked) =>
                dispatchEditorAction({
                  type: 'toggleMultipleCorrect',
                  questionIndex,
                  optionIndex,
                  checked,
                })
              }
              onSetQuestionToRemove={(value) => dispatch({ type: 'setQuestionToRemove', value })}
              invalidQuestionIndexes={invalidQuestionIndexes}
            />

            {hasValidationError ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <p className="font-semibold">{labels.validationTitle ?? 'Check quiz content'}</p>
                {invalidQuestionIndexes.length > 0 ? (
                  <p className="mt-1">
                    {labels.invalidQuestions?.(
                      invalidQuestionIndexes.map((index) => index + 1).join(', '),
                    ) ?? `Questions ${invalidQuestionIndexes.map((index) => index + 1).join(', ')}`}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="fixed inset-x-4 bottom-20 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white/95 p-3 shadow-lg backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:p-4">
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
                      (state.submitToPremium &&
                        premiumAttestation !== undefined &&
                        !premiumAttestation.checked) ||
                      isDeleting
                    }
                    className="flex items-center gap-2"
                  >
                    {state.isSubmitting ? (
                      state.submitToPremium && labels.premiumSubmitting ? (
                        labels.premiumSubmitting
                      ) : (
                        labels.submitting
                      )
                    ) : (
                      <>
                        <HiOutlineSave className="size-4" />
                        {state.submitToPremium && labels.premiumSubmit
                          ? labels.premiumSubmit
                          : labels.submit}
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
              <div className="ml-auto text-sm text-neutral-500 md:hidden" aria-live="polite">
                {headerExtra}
              </div>
            </div>
          </form>

          {footerExtra}
        </div>
      </div>

      {showPdf && pdfUrl ? (
        <WorkspacePdfPanel
          layout={pdfLayout}
          pdfUrl={pdfUrl}
          {...(pdfDataUrl !== undefined ? { pdfDataUrl } : {})}
          onClose={() => dispatch({ type: 'setShowPDFViewer', value: false })}
        />
      ) : null}
    </div>
  );
}
