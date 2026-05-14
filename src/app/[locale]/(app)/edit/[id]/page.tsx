'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import { fetchApiData } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import PDFViewer from '@/features/quiz/components/PDFViewer';
import { IQuiz } from '@/types';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import Sidebar from '@/components/Sidebar';
import {
  HiChevronDown,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineInformationCircle,
  HiOutlineEyeOff,
  HiOutlineDocumentText,
  HiOutlineSave,
  HiOutlineClipboardCopy,
  HiOutlineTrash,
} from '@/components/icons';
import { QuestionEditor } from '@/features/quiz/components/editor/QuestionEditor';
import type { Question } from '@/features/quiz/components/editor/QuestionEditor';
import { QuizMetaFormEditor } from '@/features/quiz/components/editor/QuizMetaForm';

interface Category {
  _id: string;
  name: string;
  description?: string;
  color?: string;
}

export default function EditQuizPage() {
  const _t = useTranslations('quiz');
  const _tCommon = useTranslations('common');
  const { data: session } = useSession();
  const { push } = useRouter();
  const pathname = usePathname();
  const encodedQuizId = routePathSegment(useRequiredRouteParam('id'));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [quiz, setQuiz] = useState<IQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questionToRemove, setQuestionToRemove] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editableQuestions, setEditableQuestions] = useState<Question[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  // PDF viewer state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(true);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await fetchApiData<IQuiz>(`/api/quizzes/${encodedQuizId}`);
      setQuiz(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setSelectedCategory(data.category as Category);
      setEditableQuestions(data.questions as Question[]);
      setIsPrivate(data.isPrivate || false);
      setPdfUrl((data as IQuiz & { pdfUrl?: string }).pdfUrl || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [encodedQuizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const updateQuestionField = (index: number, field: keyof Question, value: any) => {
    const updated = [...editableQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditableQuestions(updated);
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    const updated = [...editableQuestions];
    updated[qIdx].options[optIdx] = value;
    setEditableQuestions(updated);
  };

  const updateQuestionImage = (qIdx: number, url: string) => {
    updateQuestionField(qIdx, 'questionImage', url);
  };

  const removeQuestionImage = (qIdx: number) => {
    updateQuestionField(qIdx, 'questionImage', undefined);
  };

  const updateOptionImage = (qIdx: number, optIdx: number, url: string) => {
    const updated = [...editableQuestions];
    const question = updated[qIdx];
    if (!question) return;

    if (!question.optionImages) {
      question.optionImages = new Array(question.options.length).fill(undefined);
    }
    question.optionImages[optIdx] = url;
    setEditableQuestions(updated);
  };

  const removeOptionImage = (qIdx: number, optIdx: number) => {
    const updated = [...editableQuestions];
    const question = updated[qIdx];
    if (question?.optionImages) question.optionImages[optIdx] = undefined;
    setEditableQuestions(updated);
  };

  const addQuestion = () => {
    setEditableQuestions([
      ...editableQuestions,
      {
        question: '',
        options: ['', '', '', ''],
        type: 'single',
        correctIndex: 0,
        correctIndexes: [],
      },
    ]);
  };
  const removeQuestion = (idx: number) =>
    setEditableQuestions(editableQuestions.filter((_, i) => i !== idx));

  const toggleQuestionType = (idx: number, type: 'single' | 'multiple') => {
    const updated = [...editableQuestions];
    updated[idx] = {
      ...updated[idx],
      type,
      correctIndex: type === 'single' ? (updated[idx].correctIndex ?? 0) : undefined,
      correctIndexes: type === 'multiple' ? updated[idx].correctIndexes || [] : undefined,
    };
    setEditableQuestions(updated);
  };

  const setSingleCorrect = (qIdx: number, optIdx: number) => {
    updateQuestionField(qIdx, 'correctIndex', optIdx);
  };

  const toggleMultipleCorrect = (qIdx: number, optIdx: number, checked: boolean) => {
    const updated = [...editableQuestions];
    const arr = updated[qIdx].correctIndexes || [];
    updated[qIdx].correctIndexes = checked
      ? [...arr, optIdx].sort()
      : arr.filter((i) => i !== optIdx);
    setEditableQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formattedQuestions = editableQuestions.map((q: Question) => {
        const base: any = {
          question: q.question,
          options: q.options,
          type: q.type,
          ...(q.questionImage ? { questionImage: q.questionImage } : {}),
          ...(q.optionImages && q.optionImages.some(Boolean)
            ? { optionImages: q.optionImages }
            : {}),
        };
        return q.type === 'single'
          ? { ...base, correctIndex: q.correctIndex ?? 0 }
          : { ...base, correctIndexes: q.correctIndexes || [] };
      });

      const data = await fetchApiData<IQuiz>(`/api/quizzes/${encodedQuizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: selectedCategory._id,
          questions: formattedQuestions,
          isPrivate: isPrivate,
        }),
      });
      setSuccess('Quiz updated successfully!');
      setQuiz(data);
      setTimeout(() => {
        push('/pending');
      }, 2000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'An error occurred while updating the quiz',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');

    try {
      await fetchApiData<null>(`/api/quizzes/${encodedQuizId}`, {
        method: 'DELETE',
      });
      push('/pending');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'An error occurred while deleting the quiz',
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
          <p className="mt-4 text-neutral-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-neutral-600 mb-4">{error}</p>
            <Link href="/pending">
              <Button>Back to My Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz || !session) return null;

  // Check if user can edit
  const isAdmin = (session.user as any)?.role === 'admin';
  const isAuthor =
    typeof quiz.author === 'string'
      ? quiz.author === (session.user as any).id
      : (quiz.author as any)?._id === (session.user as any).id;

  if (!isAdmin && !isAuthor) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-neutral-600 mb-4">You do not have permission to edit this quiz.</p>
            <Link href="/pending">
              <Button>Back to My Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if quiz can be edited
  const canEdit = quiz.status === 'pending' || quiz.status === 'rejected' || isAdmin;

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center group">
                <div className="h-10 flex items-center justify-center transition-transform group-hover:scale-105">
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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link
                    href="/"
                    className="text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    All Quizzes
                  </Link>

                  {/* User Menu */}
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="h-auto gap-2 px-0 text-neutral-600 hover:text-neutral-900"
                    >
                      <div className="size-8 bg-gradient-to-br from-brand-trust to-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <HiChevronDown
                        className={`size-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </Button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-100 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => signOut()}
                          className="h-10 w-full justify-start rounded-none px-4 text-sm text-neutral-700 hover:bg-neutral-50"
                        >
                          <HiOutlineLogout className="inline-block mr-2" /> Sign Out
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-neutral-600 hover:text-neutral-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-brand-trust to-green-700 hover:from-brand-trust-hover hover:to-green-800 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                size="icon"
                className="text-neutral-600 hover:text-neutral-900"
              >
                <HiOutlineMenu className="size-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-neutral-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link
                      href="/"
                      className="block px-4 py-2 text-neutral-600 hover:text-neutral-900"
                    >
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
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block px-4 py-2 text-neutral-600 hover:text-neutral-900"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      className="block px-4 py-2 text-neutral-600 hover:text-neutral-900"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main
        className={`max-w-none px-4 py-8 transition-[margin] duration-300 sm:px-6 lg:px-8 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}
      >
        <div className="flex min-h-screen transition-[width] duration-300">
          {/* Left Side - Form Content */}
          <div
            className={`transition-[width,padding] duration-300 ${showPDFViewer && pdfUrl ? 'lg:w-1/2 lg:pr-4' : 'w-full'}`}
          >
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-neutral-900">Edit Quiz</h1>
                  <p className="mt-2 text-neutral-600">Make changes to your quiz information</p>
                </div>
                {/* PDF Viewer Toggle Button */}
                {pdfUrl && (
                  <Button
                    onClick={() => setShowPDFViewer(!showPDFViewer)}
                    variant="outline"
                    className="flex items-center gap-2 text-brand-trust border-green-200 hover:bg-green-50"
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
                )}
              </div>

              {/* Quiz Status */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">Quiz Status</h3>
                      <p className="text-sm text-neutral-600">Current approval status</p>
                    </div>
                    <span
                      className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium ${
                        quiz.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : quiz.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          quiz.status === 'pending'
                            ? 'bg-yellow-500'
                            : quiz.status === 'published'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                        }`}
                      />
                      {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {!canEdit && (
                <Card className="mb-6">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-3">
                      <div className="text-brand-trust">
                        <HiOutlineInformationCircle className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">Read Only</h3>
                        <p className="text-sm text-neutral-600">
                          This quiz cannot be edited because it is already published. Only admins
                          can edit published quizzes.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <QuizMetaFormEditor
                  error={error}
                  success={success}
                  title={title}
                  onTitleChange={setTitle}
                  description={description}
                  onDescriptionChange={setDescription}
                  selectedCategory={selectedCategory}
                  onCategoryChange={(category) => setSelectedCategory(category as Category | null)}
                  isPrivate={isPrivate}
                  onPrivateChange={setIsPrivate}
                  disabled={!canEdit}
                  categoryDisabled={!canEdit}
                  quiz={quiz}
                />

                <QuestionEditor
                  questions={editableQuestions}
                  canEdit={canEdit}
                  questionToRemove={questionToRemove}
                  onUpdateField={updateQuestionField}
                  onUpdateOption={updateOption}
                  onUpdateQuestionImage={updateQuestionImage}
                  onRemoveQuestionImage={removeQuestionImage}
                  onUpdateOptionImage={updateOptionImage}
                  onRemoveOptionImage={removeOptionImage}
                  onAddQuestion={addQuestion}
                  onRemoveQuestion={removeQuestion}
                  onToggleType={toggleQuestionType}
                  onSetSingleCorrect={setSingleCorrect}
                  onToggleMultipleCorrect={toggleMultipleCorrect}
                  onSetQuestionToRemove={setQuestionToRemove}
                />

                <div className="flex justify-between">
                  <div className="flex space-x-4">
                    <Link href="/pending">
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </Link>
                    {canEdit && (
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
                    )}
                  </div>

                  {canEdit && (isAuthor || isAdmin) && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={confirmDelete}
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
                  )}
                </div>
              </form>

              {quiz.status === 'published' && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Quiz Link</CardTitle>
                    <CardDescription>Share this link with your students</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4">
                      <code className="flex-1 bg-neutral-100 px-3 py-2 rounded text-sm">
                        {`${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${quiz.slug}`}
                      </code>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-2"
                        onClick={() => {
                          const url = `${window.location.origin}/quiz/${quiz.slug}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Quiz link copied to clipboard!');
                        }}
                      >
                        <HiOutlineClipboardCopy className="w-4 h-4" />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Side - PDF Viewer */}
          {showPDFViewer && pdfUrl && (
            <div className="hidden lg:block lg:w-1/2 lg:pl-4">
              <div className="sticky top-24 h-[calc(100vh-6rem)]">
                <Card className="h-full flex flex-col shadow-2xl border-2 border-green-200 bg-white">
                  <CardHeader className="flex-shrink-0 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">PDF Reference</CardTitle>
                      <Button
                        onClick={() => setShowPDFViewer(false)}
                        variant="ghost"
                        size="sm"
                        className="text-neutral-500 hover:text-neutral-700"
                      >
                        {'✕'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                    <PDFViewer
                      pdfDataUrl={null}
                      pdfUrl={pdfUrl}
                      onClose={() => setShowPDFViewer(false)}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete quiz?"
          message="Are you sure you want to delete this quiz? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="destructive"
          isLoading={deleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            await handleDelete();
          }}
        />
      </main>
    </div>
  );
}
