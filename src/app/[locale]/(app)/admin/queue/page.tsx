'use client';

import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import {
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineLockClosed,
  HiOutlinePencil,
  HiOutlineTrash,
} from '@/components/icons';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import { fetchApiData } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type QueueFilter = 'pending' | 'all';
type QueueModal = 'reject' | 'preview' | 'delete' | null;

interface AdminQueueState {
  quizzes: IQuiz[];
  loading: boolean;
  error: string;
  actionLoading: string | null;
  selectedQuiz: IQuiz | null;
  activeModal: QueueModal;
  rejectReason: string;
  filter: QueueFilter;
  deletingQuizId: string | null;
  pagination: PaginationData;
}

type AdminQueueAction =
  | { type: 'patch'; value: Partial<AdminQueueState> }
  | { type: 'startFetch' }
  | { type: 'fetchSuccess'; quizzes: IQuiz[]; pagination: PaginationData }
  | { type: 'fetchError'; message: string }
  | { type: 'setPage'; page: number }
  | { type: 'setFilter'; filter: QueueFilter }
  | { type: 'openModal'; modal: Exclude<QueueModal, null>; quiz: IQuiz | null }
  | { type: 'closeModal' }
  | { type: 'setRejectReason'; value: string }
  | { type: 'markStatus'; quizId: string; status: string }
  | { type: 'removeQuiz'; quizId: string };

const initialState: AdminQueueState = {
  quizzes: [],
  loading: true,
  error: '',
  actionLoading: null,
  selectedQuiz: null,
  activeModal: null,
  rejectReason: '',
  filter: 'pending',
  deletingQuizId: null,
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  },
};

function adminQueueReducer(state: AdminQueueState, action: AdminQueueAction): AdminQueueState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'startFetch':
      return { ...state, loading: true, error: '' };
    case 'fetchSuccess':
      return {
        ...state,
        quizzes: action.quizzes,
        pagination: action.pagination,
        loading: false,
        error: '',
      };
    case 'fetchError':
      return { ...state, loading: false, error: action.message };
    case 'setPage':
      return { ...state, pagination: { ...state.pagination, page: action.page } };
    case 'setFilter':
      return {
        ...state,
        filter: action.filter,
        pagination: { ...state.pagination, page: 1 },
      };
    case 'openModal':
      return {
        ...state,
        activeModal: action.modal,
        selectedQuiz: action.quiz,
        rejectReason: action.modal === 'reject' ? '' : state.rejectReason,
      };
    case 'closeModal':
      return {
        ...state,
        activeModal: null,
        selectedQuiz: null,
        rejectReason: '',
      };
    case 'setRejectReason':
      return { ...state, rejectReason: action.value };
    case 'markStatus':
      return {
        ...state,
        quizzes: state.quizzes.map((quiz) =>
          quiz._id === action.quizId ? { ...quiz, status: action.status as any } : quiz,
        ),
      };
    case 'removeQuiz':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz._id !== action.quizId),
      };
    default:
      return state;
  }
}

function getStatusBadge(status: string) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  switch (status) {
    case 'pending':
      return <Badge variant="warning">{label}</Badge>;
    case 'published':
      return <Badge variant="success">{label}</Badge>;
    case 'rejected':
      return <Badge variant="danger">{label}</Badge>;
    default:
      return <Badge variant="default">{label}</Badge>;
  }
}

function HydratedDateText({ dateString }: { dateString: string | Date }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const serializedDate = typeof dateString === 'string' ? dateString : dateString.toISOString();
  const date = mounted ? new Date(serializedDate) : null;

  return (
    <time dateTime={mounted && date ? date.toISOString() : serializedDate} suppressHydrationWarning>
      {mounted && date ? formatDate(date) : ''}
    </time>
  );
}

function AdminQueueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function AdminQueueLoadingState({ tCommon }: { tCommon: TranslateFn }) {
  return (
    <AdminQueueLayout>
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
        </div>
      </div>
    </AdminQueueLayout>
  );
}

function QueuePageHeader({
  filter,
  onFilterChange,
  t,
}: {
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  t: TranslateFn;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{t('adminQueue')}</h1>
        <p className="mt-2 text-neutral-600">{t('reviewManageQuizzes')}</p>
      </div>

      <div className="flex items-center gap-x-4">
        <select
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as QueueFilter)}
          className="min-h-[40px] rounded-md border border-neutral-300 px-3 text-sm transition-[border-color,box-shadow] focus-visible:border-brand-trust focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--focus-ring-soft)]"
        >
          <option value="pending">{t('pendingOnly')}</option>
          <option value="all">{t('allQuizzes')}</option>
        </select>
      </div>
    </div>
  );
}

function QueueStatsCards({
  quizzes,
  pagination,
  t,
}: {
  quizzes: IQuiz[];
  pagination: PaginationData;
  t: TranslateFn;
}) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {quizzes.filter((quiz) => quiz.status === 'pending').length}
            </div>
            <div className="text-sm text-neutral-600">{t('pendingReviewCurrentPage')}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {quizzes.filter((quiz) => quiz.status === 'published').length}
            </div>
            <div className="text-sm text-neutral-600">{t('publishedCurrentPage')}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {quizzes.filter((quiz) => quiz.status === 'rejected').length}
            </div>
            <div className="text-sm text-neutral-600">{t('rejectedCurrentPage')}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-trust">{pagination.total}</div>
            <div className="text-sm text-neutral-600">{t('totalAll')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueResultsInfo({
  quizzes,
  pagination,
  filter,
  t,
}: {
  quizzes: IQuiz[];
  pagination: PaginationData;
  filter: QueueFilter;
  t: TranslateFn;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <p className="text-neutral-600">
        {t('showingQuizzes', { count: quizzes.length, total: pagination.total })}
        {filter === 'pending' ? (
          <span className="ml-2 font-medium text-yellow-600">{t('pendingOnlyFilter')}</span>
        ) : null}
      </p>
      <p className="text-sm text-neutral-500">
        {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
      </p>
    </div>
  );
}

function QueueEmptyState({ filter, t }: { filter: QueueFilter; t: TranslateFn }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <HiOutlineDocumentText className="mx-auto mb-4 text-4xl text-neutral-400" />
        <h3 className="mb-2 text-lg font-semibold text-neutral-900">{t('noQuizzesFound')}</h3>
        <p className="text-neutral-600">
          {filter === 'pending' ? t('noQuizzesWaiting') : t('noQuizzesCreated')}
        </p>
      </CardContent>
    </Card>
  );
}

function QueueQuizCard({
  quiz,
  actionLoading,
  deletingQuizId,
  t,
  tProfile,
  onPreview,
  onReject,
  onApprove,
  onDelete,
}: {
  quiz: IQuiz;
  actionLoading: string | null;
  deletingQuizId: string | null;
  t: TranslateFn;
  tProfile: TranslateFn;
  onPreview: (quiz: IQuiz) => void;
  onReject: (quiz: IQuiz) => void;
  onApprove: (quizId: string) => void;
  onDelete: (quiz: IQuiz) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-x-3">
              <CardTitle className="text-xl">{quiz.title}</CardTitle>
              {quiz.isPrivate ? (
                <span className="inline-flex min-h-[28px] items-center rounded-full bg-neutral-100 px-3 text-[13px] font-medium text-neutral-600">
                  <HiOutlineLockClosed className="mr-1 size-3" /> {tProfile('private')}
                </span>
              ) : null}
            </div>
            <CardDescription className="mt-2">
              {quiz.description || tProfile('noDescription')}
            </CardDescription>
            <div className="mt-3 flex items-center gap-x-4 text-sm text-neutral-600">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0">{t('by')}</span>
                <UserProfileLink
                  user={quiz.author as any}
                  avatarSize={24}
                  className="max-w-[220px] text-sm text-neutral-600"
                  nameClassName="text-sm"
                />
              </div>
              <span>•</span>
              <span
                className="inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium"
                style={{
                  backgroundColor: `${(quiz.category as any)?.color || '#6b7280'}20`,
                  color: (quiz.category as any)?.color,
                }}
              >
                {(quiz.category as any)?.name || tProfile('noCategory')}
              </span>
              <span>•</span>
              <span>
                {quiz.questions.length} {t('questions')}
              </span>
              <span>•</span>
              <span>
                {t('createdDate')} <HydratedDateText dateString={quiz.createdAt} />
              </span>
            </div>
          </div>
          {getStatusBadge(quiz.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex gap-x-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPreview(quiz)}
              className="min-h-[36px] px-3"
            >
              <HiOutlineEye className="mr-1 size-4" /> {t('previewWithAnswers')}
            </Button>
            <Link
              href={`/quiz/${quiz.slug}`}
              className="inline-flex items-center text-sm font-medium text-brand-trust hover:text-green-700"
            >
              {t('testQuiz')}
            </Link>
            <Link href={`/edit/${quiz._id}`}>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] border-green-300 px-3 text-brand-trust hover:border-green-400 hover:text-brand-trust"
              >
                <HiOutlinePencil className="mr-1 size-4" /> {t('editQuiz')}
              </Button>
            </Link>
          </div>

          <div className="flex gap-x-3">
            {quiz.status === 'pending' ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(quiz)}
                  disabled={actionLoading === quiz._id}
                  className="min-h-[36px] px-3"
                >
                  {t('reject')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove(quiz._id)}
                  loading={actionLoading === quiz._id}
                  className="min-h-[36px] bg-green-600 px-3 hover:bg-green-700"
                >
                  {t('approve')}
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(quiz)}
              className="min-h-[36px] border-red-300 px-3 text-red-600 hover:border-red-400 hover:text-red-700"
              disabled={deletingQuizId === quiz._id}
            >
              {deletingQuizId === quiz._id ? (
                <>
                  <div className="mr-2 size-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  {t('deleting')}
                </>
              ) : (
                <>
                  <HiOutlineTrash className="mr-1 size-4" /> {t('delete')}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RejectQuizModal({
  isOpen,
  selectedQuiz,
  rejectReason,
  actionLoading,
  onClose,
  onRejectReasonChange,
  onConfirm,
  t,
}: {
  isOpen: boolean;
  selectedQuiz: IQuiz | null;
  rejectReason: string;
  actionLoading: string | null;
  onClose: () => void;
  onRejectReasonChange: (value: string) => void;
  onConfirm: () => void;
  t: TranslateFn;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('rejectQuiz')}
      description={t('rejectQuizDescription')}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="reason" className="mb-2 block text-sm font-medium text-neutral-700">
            {t('rejectionReason')}
          </label>
          <Textarea
            id="reason"
            rows={4}
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            placeholder={t('rejectReasonPlaceholder')}
            className="text-sm"
          />
        </div>

        <div className="flex justify-end gap-x-3">
          <Button variant="outline" onClick={onClose} className="min-h-[40px] px-4">
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={actionLoading === selectedQuiz?._id}
            disabled={!rejectReason.trim()}
            className="min-h-[40px] px-4"
          >
            {t('rejectQuizButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteQuizModal({
  quiz,
  deletingQuizId,
  onCancel,
  onConfirm,
  t,
}: {
  quiz: IQuiz | null;
  deletingQuizId: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  t: TranslateFn;
}) {
  return (
    <ConfirmModal
      isOpen={!!quiz}
      title={t('adminDeleteQuiz')}
      message={
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">{t('deleteQuizConfirm')}</p>
          <p className="rounded bg-neutral-50 p-2 text-sm font-medium text-neutral-900">
            {`"${quiz?.title || ''}"`}
          </p>
          <p className="text-sm text-neutral-600">
            {t('author')} {(quiz?.author as any)?.email || 'Unknown'}
          </p>
          <p className="text-xs text-red-600">{t('deleteQuizWarning')}</p>
        </div>
      }
      confirmText={t('deleteQuizButton')}
      cancelText={t('cancel')}
      confirmVariant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isLoading={!!(deletingQuizId && quiz && deletingQuizId === quiz._id)}
    />
  );
}

export default function AdminQueuePage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const [state, dispatch] = useReducer(adminQueueReducer, initialState);

  useEffect(() => {
    const fetchQuizzes = async () => {
      dispatch({ type: 'startFetch' });

      try {
        const params = new URLSearchParams({
          page: state.pagination.page.toString(),
          limit: state.pagination.limit.toString(),
        });

        if (state.filter === 'pending') {
          params.append('status', 'pending');
        }

        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationData }>(
          `/api/quizzes?${params}`,
        );
        dispatch({ type: 'fetchSuccess', quizzes: data.quizzes, pagination: data.pagination });
      } catch (error) {
        dispatch({
          type: 'fetchError',
          message: error instanceof Error ? error.message : 'Failed to fetch quizzes',
        });
      }
    };

    void fetchQuizzes();
  }, [state.filter, state.pagination.limit, state.pagination.page]);

  const approveQuiz = async (quizId: string) => {
    dispatch({ type: 'patch', value: { actionLoading: quizId, error: '' } });

    try {
      await fetchApiData(`/api/quizzes/${quizId}/approve`, {
        method: 'POST',
      });
      dispatch({ type: 'markStatus', quizId, status: 'published' });
      dispatch({ type: 'patch', value: { actionLoading: null } });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          error: error instanceof Error ? error.message : 'Failed to approve quiz',
        },
      });
    }
  };

  const rejectQuiz = async () => {
    if (!state.selectedQuiz) return;

    dispatch({ type: 'patch', value: { actionLoading: state.selectedQuiz._id, error: '' } });

    try {
      await fetchApiData(`/api/quizzes/${state.selectedQuiz._id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: state.rejectReason.trim(),
        }),
      });
      dispatch({ type: 'markStatus', quizId: state.selectedQuiz._id, status: 'rejected' });
      dispatch({ type: 'patch', value: { actionLoading: null } });
      dispatch({ type: 'closeModal' });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          actionLoading: null,
          error: error instanceof Error ? error.message : 'Failed to reject quiz',
        },
      });
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    dispatch({ type: 'patch', value: { deletingQuizId: quizId, error: '' } });

    try {
      await fetchApiData<null>(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      dispatch({ type: 'removeQuiz', quizId });
      dispatch({ type: 'patch', value: { deletingQuizId: null } });
      dispatch({ type: 'closeModal' });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          deletingQuizId: null,
          error:
            error instanceof Error ? error.message : 'An error occurred while deleting the quiz',
        },
      });
    }
  };

  if (state.loading) {
    return <AdminQueueLoadingState tCommon={tCommon} />;
  }

  return (
    <AdminQueueLayout>
      <div className="mx-auto max-w-6xl">
        <QueuePageHeader
          filter={state.filter}
          onFilterChange={(filter) => dispatch({ type: 'setFilter', filter })}
          t={t}
        />

        <QueueStatsCards quizzes={state.quizzes} pagination={state.pagination} t={t} />
        <QueueResultsInfo
          quizzes={state.quizzes}
          pagination={state.pagination}
          filter={state.filter}
          t={t}
        />

        {state.error ? (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{state.error}</div>
          </div>
        ) : null}

        <div className="space-y-6">
          {state.quizzes.length === 0 ? (
            <QueueEmptyState filter={state.filter} t={t} />
          ) : (
            state.quizzes.map((quiz) => (
              <QueueQuizCard
                key={quiz._id}
                quiz={quiz}
                actionLoading={state.actionLoading}
                deletingQuizId={state.deletingQuizId}
                t={t}
                tProfile={tProfile}
                onPreview={(selectedQuiz) =>
                  dispatch({ type: 'openModal', modal: 'preview', quiz: selectedQuiz })
                }
                onReject={(selectedQuiz) =>
                  dispatch({ type: 'openModal', modal: 'reject', quiz: selectedQuiz })
                }
                onApprove={(quizId) => void approveQuiz(quizId)}
                onDelete={(selectedQuiz) =>
                  dispatch({ type: 'openModal', modal: 'delete', quiz: selectedQuiz })
                }
              />
            ))
          )}

          {state.pagination.totalPages > 1 ? (
            <div className="mt-8">
              <Pagination
                currentPage={state.pagination.page}
                totalPages={state.pagination.totalPages}
                onPageChange={(newPage) => dispatch({ type: 'setPage', page: newPage })}
                className="justify-center"
              />
            </div>
          ) : null}
        </div>
      </div>

      <RejectQuizModal
        isOpen={state.activeModal === 'reject'}
        selectedQuiz={state.selectedQuiz}
        rejectReason={state.rejectReason}
        actionLoading={state.actionLoading}
        onClose={() => dispatch({ type: 'closeModal' })}
        onRejectReasonChange={(value) => dispatch({ type: 'setRejectReason', value })}
        onConfirm={() => void rejectQuiz()}
        t={t}
      />

      {state.activeModal === 'preview' && state.selectedQuiz ? (
        <QuizPreviewModal
          isOpen={true}
          onClose={() => dispatch({ type: 'closeModal' })}
          title={state.selectedQuiz.title}
          questions={state.selectedQuiz.questions}
        />
      ) : null}

      <DeleteQuizModal
        quiz={state.activeModal === 'delete' ? state.selectedQuiz : null}
        deletingQuizId={state.deletingQuizId}
        onCancel={() => dispatch({ type: 'closeModal' })}
        onConfirm={() =>
          state.selectedQuiz ? void handleDeleteQuiz(state.selectedQuiz._id) : undefined
        }
        t={t}
      />
    </AdminQueueLayout>
  );
}
