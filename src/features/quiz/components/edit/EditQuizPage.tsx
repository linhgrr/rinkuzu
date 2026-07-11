'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { toBrowserPath } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizWorkspacePageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import { QuestionEditor } from '@/features/quiz/components/editor/QuestionEditor';
import { QuizMetaFormEditor } from '@/features/quiz/components/editor/QuizMetaForm';
import {
  HiOutlineClipboardCopy,
  HiOutlineDocumentText,
  HiOutlineEyeOff,
  HiOutlineInformationCircle,
  HiOutlineSave,
  HiOutlineTrash,
} from 'react-icons/hi';
import { fetchQuizEditViewModel, updateQuizEditViewModel } from '@/features/quiz/api/quiz-edit-api';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import type {
  QuizEditViewModel,
  QuizEditorQuestionViewModel,
} from '@/features/quiz/types/quiz-editor-view-model';
import {
  addQuestion,
  removeQuestionAt,
  setSingleCorrect,
  toQuestionInputs,
  toggleMultipleCorrect,
  toggleQuestionType,
  updateOption,
  updateOptionImage,
  updateQuestionField,
  updateQuestionImage,
  type EditableQuestionField,
} from '@/features/quiz/lib/question-editor-mutations';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';

type EditPageStatus = 'loading' | 'ready' | 'error';
type EditableQuizQuestion = QuizEditorQuestionViewModel;

function getQuizAuthorId(quiz: QuizEditViewModel): string | null {
  return quiz.author?.id ?? null;
}

interface EditQuizState {
  status: EditPageStatus;
  quiz: QuizEditViewModel | null;
  saving: boolean;
  deleting: boolean;
  showDeleteConfirm: boolean;
  questionToRemove: number | null;
  error: string;
  success: string;
  title: string;
  description: string;
  selectedFolderId: string | null;
  editableQuestions: EditableQuizQuestion[];
  isPrivate: boolean;
  pdfUrl: string | null;
  showPDFViewer: boolean;
}

type EditQuizAction =
  | { type: 'patch'; value: Partial<EditQuizState> }
  | { type: 'startLoading' }
  | { type: 'loadSuccess'; quiz: QuizEditViewModel }
  | { type: 'loadError'; message: string }
  | { type: 'togglePdfViewer' }
  | { type: 'setTitle'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'setFolder'; value: string | null }
  | { type: 'setPrivate'; value: boolean }
  | { type: 'setQuestionToRemove'; value: number | null }
  | {
      type: 'updateQuestionField';
      index: number;
      field: EditableQuestionField;
      value: EditableQuizQuestion[EditableQuestionField];
    }
  | { type: 'updateOption'; questionIndex: number; optionIndex: number; value: string }
  | { type: 'updateQuestionImage'; questionIndex: number; value?: string }
  | { type: 'updateOptionImage'; questionIndex: number; optionIndex: number; value?: string }
  | { type: 'addQuestion'; question: EditableQuizQuestion }
  | { type: 'removeQuestion'; index: number }
  | { type: 'toggleQuestionType'; index: number; value: 'single' | 'multiple' }
  | { type: 'setSingleCorrect'; questionIndex: number; optionIndex: number }
  | { type: 'toggleMultipleCorrect'; questionIndex: number; optionIndex: number; checked: boolean };

const initialState: EditQuizState = {
  status: 'loading',
  quiz: null,
  saving: false,
  deleting: false,
  showDeleteConfirm: false,
  questionToRemove: null,
  error: '',
  success: '',
  title: '',
  description: '',
  selectedFolderId: null,
  editableQuestions: [],
  isPrivate: false,
  pdfUrl: null,
  showPDFViewer: true,
};

function editQuizReducer(state: EditQuizState, action: EditQuizAction): EditQuizState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'startLoading':
      return { ...state, status: 'loading', error: '' };
    case 'loadSuccess': {
      const loadedQuiz = action.quiz;
      const loadedPdfUrl = loadedQuiz.pdfUrl ?? null;

      return {
        ...state,
        status: 'ready',
        quiz: loadedQuiz,
        title: loadedQuiz.title,
        description: loadedQuiz.description ?? '',
        selectedFolderId: loadedQuiz.folder ?? null,
        editableQuestions: loadedQuiz.questions,
        isPrivate: loadedQuiz.isPrivate ?? false,
        pdfUrl: loadedPdfUrl,
        showPDFViewer: !!loadedPdfUrl,
        error: '',
      };
    }
    case 'loadError':
      return { ...state, status: 'error', error: action.message };
    case 'togglePdfViewer':
      return { ...state, showPDFViewer: !state.showPDFViewer };
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setDescription':
      return { ...state, description: action.value };
    case 'setFolder':
      return { ...state, selectedFolderId: action.value };
    case 'setPrivate':
      return { ...state, isPrivate: action.value };
    case 'setQuestionToRemove':
      return { ...state, questionToRemove: action.value };
    case 'updateQuestionField':
      return {
        ...state,
        editableQuestions: updateQuestionField(
          state.editableQuestions,
          action.index,
          action.field,
          action.value,
        ),
      };
    case 'updateOption':
      return {
        ...state,
        editableQuestions: updateOption(
          state.editableQuestions,
          action.questionIndex,
          action.optionIndex,
          action.value,
        ),
      };
    case 'updateQuestionImage':
      return {
        ...state,
        editableQuestions: updateQuestionImage(
          state.editableQuestions,
          action.questionIndex,
          action.value,
        ),
      };
    case 'updateOptionImage':
      return {
        ...state,
        editableQuestions: updateOptionImage(
          state.editableQuestions,
          action.questionIndex,
          action.optionIndex,
          action.value,
        ),
      };
    case 'addQuestion':
      return {
        ...state,
        editableQuestions: addQuestion(state.editableQuestions, action.question),
      };
    case 'removeQuestion':
      return {
        ...state,
        editableQuestions: removeQuestionAt(state.editableQuestions, action.index),
      };
    case 'toggleQuestionType':
      return {
        ...state,
        editableQuestions: toggleQuestionType(state.editableQuestions, action.index, action.value),
      };
    case 'setSingleCorrect':
      return {
        ...state,
        editableQuestions: setSingleCorrect(
          state.editableQuestions,
          action.questionIndex,
          action.optionIndex,
        ),
      };
    case 'toggleMultipleCorrect':
      return {
        ...state,
        editableQuestions: toggleMultipleCorrect(
          state.editableQuestions,
          action.questionIndex,
          action.optionIndex,
          action.checked,
        ),
      };
    default:
      return state;
  }
}

function EditQuizLoadingState() {
  return <QuizWorkspacePageSkeleton label="Loading quiz…" />;
}

function EditQuizMessageState({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-red-600">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4 text-neutral-600">{description}</p>
          <Link href="/my-quizzes">
            <Button>{actionLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-start gap-x-3">
          <div className="text-brand-trust">
            <HiOutlineInformationCircle className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Read Only</h3>
            <p className="text-sm text-neutral-600">
              You do not have permission to edit this quiz. Only its author or an administrator can
              make changes.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditQuizHeader({
  pdfUrl,
  showPDFViewer,
  onTogglePdfViewer,
}: {
  pdfUrl: string | null;
  showPDFViewer: boolean;
  onTogglePdfViewer: () => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Edit Quiz</h1>
        <p className="mt-2 text-neutral-600">Make changes to your quiz information</p>
      </div>
      {pdfUrl ? (
        <Button
          onClick={onTogglePdfViewer}
          variant="outline"
          className="flex items-center gap-2 border-green-200 text-brand-trust hover:bg-green-50"
        >
          {showPDFViewer ? (
            <>
              <HiOutlineEyeOff className="size-4" /> Hide PDF
            </>
          ) : (
            <>
              <HiOutlineDocumentText className="size-4" /> Show PDF
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

function EditQuizActionBar({
  canEdit,
  deleting,
  saving,
  title,
  onDelete,
}: {
  canEdit: boolean;
  deleting: boolean;
  saving: boolean;
  title: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-between">
      <div className="flex gap-x-4">
        <Link href="/my-quizzes">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        {canEdit ? (
          <Button
            type="submit"
            loading={saving}
            disabled={!title.trim()}
            className="flex items-center gap-2"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <HiOutlineSave className="size-4" />
                Save Changes
              </>
            )}
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          loading={deleting}
          className="flex items-center gap-2"
        >
          {deleting ? (
            'Deleting...'
          ) : (
            <>
              <HiOutlineTrash className="size-4" />
              Delete Quiz
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

function QuizLinkCard({ slug }: { slug: string }) {
  const locale = useLocale();
  const sharePath = toBrowserPath(ROUTES.QUIZ.VIEW(slug), locale);
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Quiz Link</CardTitle>
        <CardDescription>Share this link with your students</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-x-4">
          <code className="flex-1 rounded bg-neutral-100 px-3 py-2 text-sm">{shareUrl}</code>
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              void copyToClipboard(shareUrl).then((ok) => {
                if (ok) toast.success('Quiz link copied to clipboard!');
                else toast.error('Failed to copy link');
              });
            }}
          >
            <HiOutlineClipboardCopy className="size-4" />
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PdfReferencePanel({ pdfUrl, onClose }: { pdfUrl: string; onClose: () => void }) {
  return (
    <div className="hidden lg:block lg:w-1/2 lg:pl-4">
      <div className="sticky top-24 h-[calc(100vh-6rem)]">
        <Card className="flex h-full flex-col border-2 border-green-200 bg-white shadow-2xl">
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
            <PDFViewer pdfDataUrl={null} pdfUrl={pdfUrl} onClose={onClose} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EditQuizPage() {
  const { data: session } = useSession();
  const { push } = useRouter();
  const quizId = useRequiredRouteParam('id');
  const [state, dispatch] = useReducer(editQuizReducer, initialState);

  useEffect(() => {
    const fetchQuiz = async () => {
      dispatch({ type: 'startLoading' });

      try {
        const data = await fetchQuizEditViewModel(quizId);
        dispatch({ type: 'loadSuccess', quiz: data });
      } catch (error) {
        dispatch({
          type: 'loadError',
          message: error instanceof Error ? error.message : 'Failed to load quiz',
        });
      }
    };

    void fetchQuiz();
  }, [quizId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.title.trim()) {
      dispatch({ type: 'patch', value: { error: 'Title is required' } });
      return;
    }

    dispatch({ type: 'patch', value: { saving: true, error: '', success: '' } });

    try {
      const formattedQuestions = toQuestionInputs(state.editableQuestions);

      const updatedQuiz = await updateQuizEditViewModel(quizId, {
        title: state.title.trim(),
        description: state.description.trim(),
        folder: state.selectedFolderId,
        questions: formattedQuestions,
        isPrivate: state.isPrivate,
      });

      dispatch({
        type: 'patch',
        value: {
          saving: false,
          success: 'Quiz updated successfully!',
          quiz: updatedQuiz,
        },
      });
      window.setTimeout(() => {
        push('/my-quizzes');
      }, 2000);
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          saving: false,
          error:
            error instanceof Error ? error.message : 'An error occurred while updating the quiz',
        },
      });
    }
  };

  const handleDelete = async () => {
    dispatch({ type: 'patch', value: { deleting: true, error: '' } });

    try {
      await deleteQuizById(quizId);
      push('/my-quizzes');
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          deleting: false,
          error:
            error instanceof Error ? error.message : 'An error occurred while deleting the quiz',
        },
      });
    }
  };

  const addQuestion = () => {
    dispatch({
      type: 'addQuestion',
      question: {
        editorId: crypto.randomUUID(),
        question: '',
        options: ['', '', '', ''],
        type: 'single',
        correctIndex: 0,
      },
    });
  };

  if (state.status === 'loading') {
    return <EditQuizLoadingState />;
  }

  if (state.error && !state.quiz) {
    return (
      <EditQuizMessageState
        title="Error"
        description={state.error}
        actionLabel="Back to My Quizzes"
      />
    );
  }

  if (!state.quiz || !session?.user) {
    return null;
  }

  const isAdmin = session.user?.role === 'admin';
  const isAuthor = getQuizAuthorId(state.quiz) === session.user.id;

  if (!isAdmin && !isAuthor) {
    return (
      <EditQuizMessageState
        title="Access Denied"
        description="You do not have permission to edit this quiz."
        actionLabel="Back to My Quizzes"
      />
    );
  }

  const canEdit = isAuthor || isAdmin;

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-h-screen transition-[width] duration-300">
          <div
            className={`transition-[width,padding] duration-300 ${state.showPDFViewer && state.pdfUrl ? 'lg:w-1/2 lg:pr-4' : 'w-full'}`}
          >
            <div className="mx-auto max-w-4xl">
              <EditQuizHeader
                pdfUrl={state.pdfUrl}
                showPDFViewer={state.showPDFViewer}
                onTogglePdfViewer={() => dispatch({ type: 'togglePdfViewer' })}
              />

              {!canEdit ? <ReadOnlyNotice /> : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <QuizMetaFormEditor
                  error={state.error}
                  success={state.success}
                  title={state.title}
                  onTitleChange={(value) => dispatch({ type: 'setTitle', value })}
                  description={state.description}
                  onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
                  selectedFolderId={state.selectedFolderId}
                  onFolderChange={(value) => dispatch({ type: 'setFolder', value })}
                  isPrivate={state.isPrivate}
                  onPrivateChange={(value) => dispatch({ type: 'setPrivate', value })}
                  disabled={!canEdit}
                  quiz={state.quiz}
                />

                <QuestionEditor
                  questions={state.editableQuestions}
                  canEdit={canEdit}
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
                    dispatch({ type: 'updateOptionImage', questionIndex, optionIndex, value: url })
                  }
                  onRemoveOptionImage={(questionIndex, optionIndex) =>
                    dispatch({
                      type: 'updateOptionImage',
                      questionIndex,
                      optionIndex,
                      value: undefined,
                    })
                  }
                  onAddQuestion={addQuestion}
                  onRemoveQuestion={(index) => dispatch({ type: 'removeQuestion', index })}
                  onToggleType={(index, type) =>
                    dispatch({ type: 'toggleQuestionType', index, value: type })
                  }
                  onSetSingleCorrect={(questionIndex, optionIndex) =>
                    dispatch({ type: 'setSingleCorrect', questionIndex, optionIndex })
                  }
                  onToggleMultipleCorrect={(questionIndex, optionIndex, checked) =>
                    dispatch({ type: 'toggleMultipleCorrect', questionIndex, optionIndex, checked })
                  }
                  onSetQuestionToRemove={(value) =>
                    dispatch({ type: 'setQuestionToRemove', value })
                  }
                />

                <EditQuizActionBar
                  canEdit={canEdit && (isAuthor || isAdmin)}
                  deleting={state.deleting}
                  saving={state.saving}
                  title={state.title}
                  onDelete={() => dispatch({ type: 'patch', value: { showDeleteConfirm: true } })}
                />
              </form>

              <QuizLinkCard slug={state.quiz.slug} />
            </div>
          </div>

          {state.showPDFViewer && state.pdfUrl ? (
            <PdfReferencePanel
              pdfUrl={state.pdfUrl}
              onClose={() => dispatch({ type: 'togglePdfViewer' })}
            />
          ) : null}
        </div>

        <ConfirmModal
          isOpen={state.showDeleteConfirm}
          title="Delete quiz?"
          message="Are you sure you want to delete this quiz? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="destructive"
          isLoading={state.deleting}
          onCancel={() => dispatch({ type: 'patch', value: { showDeleteConfirm: false } })}
          onConfirm={async () => {
            dispatch({ type: 'patch', value: { showDeleteConfirm: false } });
            await handleDelete();
          }}
        />
      </main>
    </div>
  );
}
