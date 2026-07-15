'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
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
import { extractUnknownErrorMessage } from '@/lib/api/error';

function EditQuizLoadingState({ label }: { label: string }) {
  return <QuizWorkspacePageSkeleton label={label} />;
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

function ReadOnlyNotice({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-start gap-x-3">
          <div className="text-brand-trust">
            <HiOutlineInformationCircle className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
            <p className="text-sm text-neutral-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuizLinkCard({
  slug,
  title,
  description,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  slug: string;
  title: string;
  description: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
}) {
  const locale = useLocale();
  const sharePath = toBrowserPath(ROUTES.QUIZ.VIEW(slug), locale);
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
                if (ok) toast.success(copiedLabel);
                else toast.error(copyFailedLabel);
              });
            }}
          >
            <HiOutlineClipboardCopy className="size-4" />
            {copyLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EditQuizPage() {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const tQuiz = useTranslations('quiz');
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
        setLoadError(extractUnknownErrorMessage(error, t('loadFailed')));
        setStatus('error');
      }
    };

    void fetchQuiz();
  }, [quizId, t]);

  if (status === 'loading') {
    return <EditQuizLoadingState label={tCommon('loading')} />;
  }

  if (status === 'error' || (loadError && !quiz)) {
    return (
      <EditQuizMessageState
        title={tCommon('error')}
        description={loadError || t('loadFailed')}
        actionLabel={t('backToMyQuizzes')}
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
        title={t('accessDenied')}
        description={t('accessDeniedDescription')}
        actionLabel={t('backToMyQuizzes')}
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
            ...(quiz.description !== undefined ? { description: quiz.description } : {}),
            selectedFolderId: quiz.folder,
            isPrivate: quiz.isPrivate,
            questions: quiz.questions,
          }}
          {...(quiz.pdfUrl !== undefined ? { pdfUrl: quiz.pdfUrl } : {})}
          pdfLayout="card"
          canEdit={canEdit}
          showPrivateToggle={canEdit}
          {...(statusError ? { statusError } : {})}
          {...(statusSuccess ? { statusSuccess } : {})}
          labels={{
            pageTitle: t('editQuizTitle'),
            pageSubtitle: t('editQuizSubtitle'),
            questionsCount: (count) => tCommon('questionsCount', { count }),
            metaTitle: t('quizInformation'),
            metaDescription: t('quizInformationDescription'),
            title: t('quizTitle'),
            titlePlaceholder: t('titlePlaceholderEdit'),
            description: t('descriptionOptional'),
            descriptionPlaceholder: t('descriptionPlaceholderEdit'),
            folder: t('folderLabel'),
            privateLabel: t('privateQuiz'),
            privateDescription: t('privateQuizDescription'),
            cancel: tCommon('cancel'),
            submit: t('saveChanges'),
            submitting: t('savingChanges'),
            hidePdf: t('hidePdfShort'),
            showPdf: t('showPdfShort'),
            delete: t('deleteQuiz'),
            deleting: t('deletingQuiz'),
          }}
          banner={
            !canEdit ? (
              <ReadOnlyNotice title={t('readOnlyTitle')} description={t('readOnlyDescription')} />
            ) : null
          }
          metaExtra={
            quiz.questionCount > 0 || createdAtLabel ? (
              <div className="border-t border-neutral-200 pt-4">
                <h4 className="mb-2 text-sm font-medium text-neutral-900">{t('quizContent')}</h4>
                <div className="space-y-1 text-sm text-neutral-600">
                  <p>
                    <span className="font-medium">{t('questionsLabel')}:</span> {quiz.questionCount}
                  </p>
                  {createdAtLabel ? (
                    <p>
                      <span className="font-medium">{t('createdLabel')}:</span>{' '}
                      <time dateTime={quiz.createdAt}>{createdAtLabel}</time>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null
          }
          footerExtra={
            <QuizLinkCard
              slug={quiz.slug}
              title={t('quizLink')}
              description={t('quizLinkDescription')}
              copyLabel={t('copyLink')}
              copiedLabel={t('linkCopied')}
              copyFailedLabel={t('linkCopyFailed')}
            />
          }
          onCancel={() => push('/my-quizzes')}
          {...(canEdit ? { onDelete: () => setShowDeleteConfirm(true) } : {})}
          isDeleting={deleting}
          onSubmit={async (payload) => {
            // BE: updateQuizRequestSchema — title min 1, questions via questionListSchema
            if (!payload.title.trim()) {
              setStatusError(t('titleRequired'));
              throw new Error('title_required');
            }
            setStatusError('');
            setStatusSuccess('');
            try {
              const updatedQuiz = await updateQuizEditViewModel(quizId, {
                title: payload.title,
                description: payload.description,
                folder: payload.selectedFolderId,
                questions: payload.questions,
                isPrivate: payload.isPrivate,
              });
              setQuiz(updatedQuiz);
              setStatusSuccess(t('updateSuccess'));
              window.setTimeout(() => {
                push('/my-quizzes');
              }, 2000);
            } catch (error) {
              setStatusError(extractUnknownErrorMessage(error, t('updateFailed')));
              throw error;
            }
          }}
        />

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title={t('deleteQuizConfirmTitle')}
          message={t('deleteQuizConfirmMessage')}
          confirmText={tQuiz('delete')}
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
              setStatusError(extractUnknownErrorMessage(error, t('deleteFailed')));
            }
          }}
        />
      </main>
    </div>
  );
}
