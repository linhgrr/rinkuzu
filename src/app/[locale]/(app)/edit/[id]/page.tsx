'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useReducer } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import { QuestionEditor } from '@/features/quiz/components/editor/QuestionEditor';
import type { Question } from '@/features/quiz/components/editor/QuestionEditor';
import { QuizMetaFormEditor } from '@/features/quiz/components/editor/QuizMetaForm';
import {
  HiChevronDown,
  HiOutlineClipboardCopy,
  HiOutlineDocumentText,
  HiOutlineEyeOff,
  HiOutlineInformationCircle,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineSave,
  HiOutlineTrash,
} from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { IQuiz } from '@/types';

interface Category {
  _id: string;
  name: string;
  description?: string;
  color?: string;
}

type EditPageStatus = 'loading' | 'ready' | 'error';

interface EditQuizState {
  status: EditPageStatus;
  isMenuOpen: boolean;
  quiz: IQuiz | null;
  saving: boolean;
  deleting: boolean;
  showDeleteConfirm: boolean;
  questionToRemove: number | null;
  error: string;
  success: string;
  title: string;
  description: string;
  selectedCategory: Category | null;
  editableQuestions: Question[];
  isPrivate: boolean;
  pdfUrl: string | null;
  showPDFViewer: boolean;
}

type EditQuizAction =
  | { type: 'patch'; value: Partial<EditQuizState> }
  | { type: 'startLoading' }
  | { type: 'loadSuccess'; quiz: IQuiz }
  | { type: 'loadError'; message: string }
  | { type: 'toggleMenu' }
  | { type: 'togglePdfViewer' }
  | { type: 'setTitle'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'setCategory'; value: Category | null }
  | { type: 'setPrivate'; value: boolean }
  | { type: 'setQuestionToRemove'; value: number | null }
  | { type: 'updateQuestionField'; index: number; field: keyof Question; value: unknown }
  | { type: 'updateOption'; questionIndex: number; optionIndex: number; value: string }
  | { type: 'updateQuestionImage'; questionIndex: number; value?: string }
  | { type: 'updateOptionImage'; questionIndex: number; optionIndex: number; value?: string }
  | { type: 'addQuestion' }
  | { type: 'removeQuestion'; index: number }
  | { type: 'toggleQuestionType'; index: number; value: 'single' | 'multiple' }
  | { type: 'setSingleCorrect'; questionIndex: number; optionIndex: number }
  | { type: 'toggleMultipleCorrect'; questionIndex: number; optionIndex: number; checked: boolean };

const initialState: EditQuizState = {
  status: 'loading',
  isMenuOpen: false,
  quiz: null,
  saving: false,
  deleting: false,
  showDeleteConfirm: false,
  questionToRemove: null,
  error: '',
  success: '',
  title: '',
  description: '',
  selectedCategory: null,
  editableQuestions: [],
  isPrivate: false,
  pdfUrl: null,
  showPDFViewer: true,
};

function toQuestionArray(questions: unknown[]): Question[] {
  return questions as Question[];
}

function editQuizReducer(state: EditQuizState, action: EditQuizAction): EditQuizState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'startLoading':
      return { ...state, status: 'loading', error: '' };
    case 'loadSuccess': {
      const loadedQuiz = action.quiz;
      const loadedPdfUrl = (loadedQuiz as IQuiz & { pdfUrl?: string }).pdfUrl || null;

      return {
        ...state,
        status: 'ready',
        quiz: loadedQuiz,
        title: loadedQuiz.title,
        description: loadedQuiz.description || '',
        selectedCategory: loadedQuiz.category as Category,
        editableQuestions: toQuestionArray(loadedQuiz.questions),
        isPrivate: loadedQuiz.isPrivate || false,
        pdfUrl: loadedPdfUrl,
        showPDFViewer: !!loadedPdfUrl,
        error: '',
      };
    }
    case 'loadError':
      return { ...state, status: 'error', error: action.message };
    case 'toggleMenu':
      return { ...state, isMenuOpen: !state.isMenuOpen };
    case 'togglePdfViewer':
      return { ...state, showPDFViewer: !state.showPDFViewer };
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setDescription':
      return { ...state, description: action.value };
    case 'setCategory':
      return { ...state, selectedCategory: action.value };
    case 'setPrivate':
      return { ...state, isPrivate: action.value };
    case 'setQuestionToRemove':
      return { ...state, questionToRemove: action.value };
    case 'updateQuestionField':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) =>
          index === action.index ? { ...question, [action.field]: action.value } : question,
        ),
      };
    case 'updateOption':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) => {
          if (index !== action.questionIndex) {
            return question;
          }

          const options = [...question.options];
          options[action.optionIndex] = action.value;
          return { ...question, options };
        }),
      };
    case 'updateQuestionImage':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) =>
          index === action.questionIndex ? { ...question, questionImage: action.value } : question,
        ),
      };
    case 'updateOptionImage':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) => {
          if (index !== action.questionIndex) {
            return question;
          }

          const optionImages = question.optionImages
            ? [...question.optionImages]
            : new Array(question.options.length).fill(undefined);
          optionImages[action.optionIndex] = action.value;
          return { ...question, optionImages };
        }),
      };
    case 'addQuestion':
      return {
        ...state,
        editableQuestions: [
          ...state.editableQuestions,
          {
            question: '',
            options: ['', '', '', ''],
            type: 'single',
            correctIndex: 0,
            correctIndexes: [],
          },
        ],
      };
    case 'removeQuestion':
      return {
        ...state,
        editableQuestions: state.editableQuestions.filter((_, index) => index !== action.index),
      };
    case 'toggleQuestionType':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) =>
          index === action.index
            ? {
                ...question,
                type: action.value,
                correctIndex: action.value === 'single' ? (question.correctIndex ?? 0) : undefined,
                correctIndexes:
                  action.value === 'multiple' ? question.correctIndexes || [] : undefined,
              }
            : question,
        ),
      };
    case 'setSingleCorrect':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) =>
          index === action.questionIndex
            ? { ...question, correctIndex: action.optionIndex }
            : question,
        ),
      };
    case 'toggleMultipleCorrect':
      return {
        ...state,
        editableQuestions: state.editableQuestions.map((question, index) => {
          if (index !== action.questionIndex) {
            return question;
          }

          const current = question.correctIndexes || [];
          const correctIndexes = action.checked
            ? [...current, action.optionIndex].sort()
            : current.filter((value) => value !== action.optionIndex);
          return { ...question, correctIndexes };
        }),
      };
    default:
      return state;
  }
}

function EditQuizLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="mx-auto size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
        <p className="mt-4 text-neutral-600">Loading quiz…</p>
      </div>
    </div>
  );
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
          <Link href="/pending">
            <Button>{actionLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function EditQuizTopNav({
  isMenuOpen,
  sessionEmail,
  onToggleMenu,
}: {
  isMenuOpen: boolean;
  sessionEmail?: string | null;
  onToggleMenu: () => void;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="group flex items-center">
              <div className="flex h-10 items-center justify-center transition-transform group-hover:scale-105">
                <Image
                  src="/images/auth_logo.png"
                  alt="RinKuzu Logo"
                  width={96}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-x-8 md:flex">
            <Link href="/" className="text-neutral-600 transition-colors hover:text-neutral-900">
              All Quizzes
            </Link>

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                onClick={onToggleMenu}
                className="h-auto gap-2 px-0 text-neutral-600 hover:text-neutral-900"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-trust to-green-600">
                  <span className="text-sm font-medium text-white">
                    {sessionEmail?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <HiChevronDown
                  className={`size-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                />
              </Button>

              {isMenuOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-neutral-100 bg-white py-1 shadow-lg">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => signOut()}
                    className="h-10 w-full justify-start rounded-none px-4 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <HiOutlineLogout className="mr-2 inline-block" /> Sign Out
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="md:hidden">
            <Button
              type="button"
              variant="ghost"
              onClick={onToggleMenu}
              size="icon"
              className="text-neutral-600 hover:text-neutral-900"
            >
              <HiOutlineMenu className="size-6" />
            </Button>
          </div>
        </div>

        {isMenuOpen ? (
          <div className="border-t border-neutral-100 py-4 md:hidden">
            <div className="space-y-2">
              <Link href="/" className="block px-4 py-2 text-neutral-600 hover:text-neutral-900">
                All Quizzes
              </Link>
              <Button
                type="button"
                variant="ghost"
                onClick={() => signOut()}
                className="h-10 w-full justify-start px-4 text-neutral-600 hover:text-neutral-900"
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function QuizStatusCard({ status }: { status: string }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Quiz Status</h3>
            <p className="text-sm text-neutral-600">Current approval status</p>
          </div>
          <span
            className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium ${
              status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            <div
              className={`mr-2 size-2 rounded-full ${
                status === 'pending'
                  ? 'bg-yellow-500'
                  : status === 'published'
                    ? 'bg-green-500'
                    : 'bg-red-500'
              }`}
            />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </CardContent>
    </Card>
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
              This quiz cannot be edited because it is already published. Only admins can edit
              published quizzes.
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
        <Link href="/pending">
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

function PublishedQuizLinkCard({ slug }: { slug: string }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Quiz Link</CardTitle>
        <CardDescription>Share this link with your students</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-x-4">
          <code className="flex-1 rounded bg-neutral-100 px-3 py-2 text-sm">
            {`${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${slug}`}
          </code>
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              const url = `${window.location.origin}/quiz/${slug}`;
              navigator.clipboard.writeText(url);
              toast.success('Quiz link copied to clipboard!');
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
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">PDF Reference</CardTitle>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-neutral-500 hover:text-neutral-700"
              >
                {'✕'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
            <PDFViewer pdfDataUrl={null} pdfUrl={pdfUrl} onClose={onClose} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EditQuizPage() {
  const { data: session } = useSession();
  const { push } = useRouter();
  const encodedQuizId = routePathSegment(useRequiredRouteParam('id'));
  const [state, dispatch] = useReducer(editQuizReducer, initialState);

  useEffect(() => {
    const fetchQuiz = async () => {
      dispatch({ type: 'startLoading' });

      try {
        const data = await fetchApiData<IQuiz>(`/api/quizzes/${encodedQuizId}`);
        dispatch({ type: 'loadSuccess', quiz: data });
      } catch (error) {
        dispatch({
          type: 'loadError',
          message: error instanceof Error ? error.message : 'Failed to load quiz',
        });
      }
    };

    void fetchQuiz();
  }, [encodedQuizId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.title.trim()) {
      dispatch({ type: 'patch', value: { error: 'Title is required' } });
      return;
    }

    if (!state.selectedCategory) {
      dispatch({ type: 'patch', value: { error: 'Please select a category' } });
      return;
    }

    dispatch({ type: 'patch', value: { saving: true, error: '', success: '' } });

    try {
      const formattedQuestions = state.editableQuestions.map((question) => {
        const base = {
          question: question.question,
          options: question.options,
          type: question.type,
          ...(question.questionImage ? { questionImage: question.questionImage } : {}),
          ...(question.optionImages && question.optionImages.some(Boolean)
            ? { optionImages: question.optionImages }
            : {}),
        };

        return question.type === 'single'
          ? { ...base, correctIndex: question.correctIndex ?? 0 }
          : { ...base, correctIndexes: question.correctIndexes || [] };
      });

      const updatedQuiz = await fetchApiData<IQuiz>(`/api/quizzes/${encodedQuizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: state.title.trim(),
          description: state.description.trim(),
          category: state.selectedCategory._id,
          questions: formattedQuestions,
          isPrivate: state.isPrivate,
        }),
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
        push('/pending');
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
      await fetchApiData<null>(`/api/quizzes/${encodedQuizId}`, {
        method: 'DELETE',
      });
      push('/pending');
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

  if (!state.quiz || !session) {
    return null;
  }

  const isAdmin = session.user?.role === 'admin';
  const isAuthor =
    typeof state.quiz.author === 'string'
      ? state.quiz.author === session.user.id
      : (state.quiz.author as { _id?: string })?._id === session.user.id;

  if (!isAdmin && !isAuthor) {
    return (
      <EditQuizMessageState
        title="Access Denied"
        description="You do not have permission to edit this quiz."
        actionLabel="Back to My Quizzes"
      />
    );
  }

  const canEdit = state.quiz.status === 'pending' || state.quiz.status === 'rejected' || isAdmin;

  return (
    <div className="min-h-screen bg-white">
      <EditQuizTopNav
        isMenuOpen={state.isMenuOpen}
        sessionEmail={session.user?.email}
        onToggleMenu={() => dispatch({ type: 'toggleMenu' })}
      />

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

              <QuizStatusCard status={state.quiz.status} />

              {!canEdit ? <ReadOnlyNotice /> : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <QuizMetaFormEditor
                  error={state.error}
                  success={state.success}
                  title={state.title}
                  onTitleChange={(value) => dispatch({ type: 'setTitle', value })}
                  description={state.description}
                  onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
                  selectedCategory={state.selectedCategory}
                  onCategoryChange={(category) =>
                    dispatch({ type: 'setCategory', value: category as Category | null })
                  }
                  isPrivate={state.isPrivate}
                  onPrivateChange={(value) => dispatch({ type: 'setPrivate', value })}
                  disabled={!canEdit}
                  categoryDisabled={!canEdit}
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
                  onAddQuestion={() => dispatch({ type: 'addQuestion' })}
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

              {state.quiz.status === 'published' ? (
                <PublishedQuizLinkCard slug={state.quiz.slug} />
              ) : null}
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
