'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
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
import { QuizEditorWorkspace } from '@/features/quiz/components/editor/QuizEditorWorkspace';
import { HiOutlineClipboardCopy, HiOutlineInformationCircle } from 'react-icons/hi';
import { fetchQuizEditViewModel, updateQuizEditViewModel } from '@/features/quiz/api/quiz-edit-api';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import type { QuizEditViewModel } from '@/features/quiz/types/quiz-editor-view-model';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { formatDate } from '@/lib/formatters';

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
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

export function EditQuizPage() {
  const { data: session } = useSession();
  const { push } = useRouter();
  const quizId = useRequiredRouteParam('id');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [quiz, setQuiz] = useState<QuizEditViewModel | null>(null);
  const [loadError, setLoadError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      setStatus('loading');
      setLoadError('');
      try {
        const data = await fetchQuizEditViewModel(quizId);
        setQuiz(data);
        setStatus('ready');
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load quiz');
        setStatus('error');
      }
    };

    void fetchQuiz();
  }, [quizId]);

  if (status === 'loading') {
    return <EditQuizLoadingState />;
  }

  if (status === 'error' || (loadError && !quiz)) {
    return (
      <EditQuizMessageState
        title="Error"
        description={loadError || 'Failed to load quiz'}
        actionLabel="Back to My Quizzes"
      />
    );
  }

  if (!quiz || !session?.user) {
    return null;
  }

  const isAdmin = session.user?.role === 'admin';
  const isAuthor = (quiz.author?.id ?? null) === session.user.id;

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
  const createdAtLabel = formatDate(quiz.createdAt, { emptyLabel: '' });

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-none px-0 py-0 sm:px-0 lg:px-0">
        <QuizEditorWorkspace
          key={quiz.id}
          initial={{
            title: quiz.title,
            description: quiz.description,
            selectedFolderId: quiz.folder,
            isPrivate: quiz.isPrivate,
            questions: quiz.questions,
          }}
          pdfUrl={quiz.pdfUrl}
          pdfLayout="card"
          canEdit={canEdit}
          showPrivateToggle={canEdit}
          statusError={statusError}
          statusSuccess={statusSuccess}
          labels={{
            pageTitle: 'Edit Quiz',
            pageSubtitle: 'Make changes to your quiz information',
            questionsCount: (count) => `${count} questions`,
            metaTitle: 'Quiz Information',
            metaDescription: 'Update the basic information about your quiz',
            title: 'Quiz Title',
            titlePlaceholder: 'Enter a descriptive title for your quiz',
            description: 'Description (Optional)',
            descriptionPlaceholder: 'Provide additional context about the quiz',
            folder: 'Folder',
            privateLabel: 'Private Quiz',
            privateDescription: '(Only visible to you and admins)',
            cancel: 'Cancel',
            submit: 'Save Changes',
            submitting: 'Saving...',
            hidePdf: 'Hide PDF',
            showPdf: 'Show PDF',
            delete: 'Delete Quiz',
            deleting: 'Deleting...',
          }}
          banner={!canEdit ? <ReadOnlyNotice /> : null}
          metaExtra={
            quiz.questionCount > 0 || createdAtLabel ? (
              <div className="border-t border-neutral-200 pt-4">
                <h4 className="mb-2 text-sm font-medium text-neutral-900">Quiz Content</h4>
                <div className="space-y-1 text-sm text-neutral-600">
                  <p>
                    <span className="font-medium">Questions:</span> {quiz.questionCount}
                  </p>
                  {createdAtLabel ? (
                    <p>
                      <span className="font-medium">Created:</span>{' '}
                      <time dateTime={quiz.createdAt}>{createdAtLabel}</time>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null
          }
          footerExtra={<QuizLinkCard slug={quiz.slug} />}
          onCancel={() => push('/my-quizzes')}
          onDelete={canEdit ? () => setShowDeleteConfirm(true) : undefined}
          isDeleting={deleting}
          onSubmit={async (payload) => {
            if (!payload.title.trim()) {
              setStatusError('Title is required');
              throw new Error('title_required');
            }
            setStatusError('');
            setStatusSuccess('');
            try {
              const updatedQuiz = await updateQuizEditViewModel(quizId, {
                title: payload.title,
                description: payload.description,
                folder: payload.selectedFolderId,
                questions: payload.questionInputs,
                isPrivate: payload.isPrivate,
              });
              setQuiz(updatedQuiz);
              setStatusSuccess('Quiz updated successfully!');
              window.setTimeout(() => {
                push('/my-quizzes');
              }, 2000);
            } catch (error) {
              setStatusError(
                error instanceof Error
                  ? error.message
                  : 'An error occurred while updating the quiz',
              );
              throw error;
            }
          }}
        />

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
            setDeleting(true);
            setStatusError('');
            try {
              await deleteQuizById(quizId);
              push('/my-quizzes');
            } catch (error) {
              setDeleting(false);
              setStatusError(
                error instanceof Error
                  ? error.message
                  : 'An error occurred while deleting the quiz',
              );
            }
          }}
        />
      </main>
    </div>
  );
}
