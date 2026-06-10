'use client';

import { useEffect, useReducer, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import Pagination from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { IQuiz, PaginationMeta } from '@/types';
import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineLockClosed,
  HiOutlinePlay,
} from '@/components/icons';

type QuizFilter = 'all' | 'pending' | 'published' | 'rejected';

interface ProfileQuizzesState {
  quizzes: IQuiz[];
  loading: boolean;
  error: string;
  filter: QuizFilter;
  previewQuiz: IQuiz | null;
  deletingQuizId: string | null;
  quizToDelete: IQuiz | null;
  pagination: PaginationMeta;
}

type ProfileQuizzesAction =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; quizzes: IQuiz[]; pagination: PaginationMeta }
  | { type: 'fetch:error'; error: string }
  | { type: 'filter:set'; filter: QuizFilter }
  | { type: 'page:set'; page: number }
  | { type: 'preview:open'; quiz: IQuiz }
  | { type: 'preview:close' }
  | { type: 'delete:prompt'; quiz: IQuiz }
  | { type: 'delete:start'; quizId: string }
  | { type: 'delete:success'; quizId: string }
  | { type: 'delete:error'; error: string }
  | { type: 'delete:cancel' };

const INITIAL_PAGINATION: PaginationMeta = {
  currentPage: 1,
  itemsPerPage: 12,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

const ITEMS_PER_PAGE = 12;

const initialState: ProfileQuizzesState = {
  quizzes: [],
  loading: true,
  error: '',
  filter: 'all',
  previewQuiz: null,
  deletingQuizId: null,
  quizToDelete: null,
  pagination: INITIAL_PAGINATION,
};

function profileQuizzesReducer(
  state: ProfileQuizzesState,
  action: ProfileQuizzesAction,
): ProfileQuizzesState {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true };
    case 'fetch:success':
      return {
        ...state,
        quizzes: action.quizzes,
        pagination: action.pagination,
        loading: false,
        error: '',
      };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    case 'filter:set':
      return {
        ...state,
        filter: action.filter,
        error: '',
        pagination: { ...state.pagination, currentPage: 1 },
      };
    case 'page:set':
      return {
        ...state,
        error: '',
        pagination: { ...state.pagination, currentPage: action.page },
      };
    case 'preview:open':
      return { ...state, previewQuiz: action.quiz };
    case 'preview:close':
      return { ...state, previewQuiz: null };
    case 'delete:prompt':
      return { ...state, quizToDelete: action.quiz };
    case 'delete:start':
      return { ...state, deletingQuizId: action.quizId };
    case 'delete:success':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz._id !== action.quizId),
        error: '',
        deletingQuizId: null,
        quizToDelete: null,
        pagination: {
          ...state.pagination,
          totalItems: Math.max(state.pagination.totalItems - 1, 0),
        },
      };
    case 'delete:error':
      return { ...state, error: action.error, deletingQuizId: null };
    case 'delete:cancel':
      return { ...state, deletingQuizId: null, quizToDelete: null };
    default:
      return state;
  }
}

function QuizCreatedAt({ createdAt }: { createdAt: string | Date }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const createdAtDate = new Date(createdAt);
    setLabel(formatDate(createdAtDate));
  }, [createdAt]);

  return (
    <time dateTime={new Date(createdAt).toISOString()} suppressHydrationWarning>
      {label}
    </time>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-surface-warm text-ink';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <HiOutlineClock className="size-5 text-yellow-500" />;
    case 'published':
      return <HiOutlineCheckCircle className="size-5 text-green-500" />;
    case 'rejected':
      return <HiOutlineXCircle className="size-5 text-red-500" />;
    default:
      return <HiOutlineDocumentText className="size-5 text-ink-muted" />;
  }
}

function StatCard({
  value,
  label,
  valueClassName = 'text-ink',
}: {
  value: number;
  label: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
        <div className="text-xs text-ink-muted">{label}</div>
      </CardContent>
    </Card>
  );
}

function ProfileQuizzesStats({
  quizzes,
  pagination,
  t,
  tCommon,
}: {
  quizzes: IQuiz[];
  pagination: PaginationMeta;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  const countByStatus = (status: string) => quizzes.filter((quiz) => quiz.status === status).length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard value={pagination.totalItems} label={tCommon('total')} />
      <StatCard
        value={countByStatus('pending')}
        label={t('pending')}
        valueClassName="text-yellow-600"
      />
      <StatCard
        value={countByStatus('published')}
        label={t('published')}
        valueClassName="text-green-600"
      />
      <StatCard
        value={countByStatus('rejected')}
        label={t('rejected')}
        valueClassName="text-red-600"
      />
    </div>
  );
}

function ProfileQuizCard({
  quiz,
  t,
  onOpenPreview,
  onOpenDeleteConfirm,
}: {
  quiz: IQuiz;
  t: (key: string) => string;
  onOpenPreview: (quiz: IQuiz) => void;
  onOpenDeleteConfirm: (quiz: IQuiz) => void;
}) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <CardTitle className="truncate text-lg">{quiz.title}</CardTitle>
              <span className="shrink-0 text-xl">{getStatusIcon(quiz.status)}</span>
              {quiz.isPrivate && (
                <span className="flex shrink-0 items-center rounded-full bg-surface-warm px-2 py-0.5 text-xs text-ink-muted">
                  <HiOutlineLockClosed className="mr-1 size-3" /> {t('private')}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(quiz.status)}`}
              >
                {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
              </span>
            </div>
            <CardDescription className="mt-1 line-clamp-2 text-sm">
              {quiz.description || t('noDescription')}
            </CardDescription>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              <span>{quiz.questions.length} Qs</span>
              <span>•</span>
              {(() => {
                const cat = quiz.category as { color?: string; name?: string } | string | undefined;
                const isPopulated = cat && typeof cat === 'object';
                return (
                  <span style={{ color: isPopulated ? cat.color : undefined }}>
                    {(isPopulated ? cat.name : undefined) || t('noCategory')}
                  </span>
                );
              })()}
              <span>•</span>
              <QuizCreatedAt createdAt={quiz.createdAt} />
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Link href={`/quiz/${quiz.slug}`}>
              <Button
                size="sm"
                variant="outline"
                className="border-accent/30 text-accent hover:border-accent/50 hover:text-accent-hover"
              >
                <HiOutlinePlay className="size-4" />
              </Button>
            </Link>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenPreview(quiz)}
              className="hidden sm:inline-flex"
            >
              <HiOutlineEye className="size-4" />
            </Button>

            <Link href={`/edit/${quiz._id}`}>
              <Button size="sm" variant="outline">
                <HiOutlinePencil className="size-4" />
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDeleteConfirm(quiz)}
              className="border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
            >
              <HiOutlineTrash className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function ProfileQuizzes() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileQuizzesReducer, initialState);

  useEffect(() => {
    let isActive = true;

    const fetchMyQuizzes = async () => {
      try {
        dispatch({ type: 'fetch:start' });
        const params = new URLSearchParams({
          page: state.pagination.currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          mine: 'true',
        });

        if (state.filter !== 'all') {
          params.append('status', state.filter);
        }

        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationMeta }>(
          `/api/quizzes?${params}`,
        );

        if (!isActive) {
          return;
        }

        dispatch({
          type: 'fetch:success',
          quizzes: data.quizzes,
          pagination: data.pagination,
        });
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        dispatch({
          type: 'fetch:error',
          error: extractUnknownErrorMessage(error, 'Failed to fetch quizzes'),
        });
      }
    };

    fetchMyQuizzes();

    return () => {
      isActive = false;
    };
  }, [state.filter, state.pagination.currentPage]);

  const handlePageChange = (newPage: number) => {
    dispatch({ type: 'page:set', page: newPage });
  };

  const openPreviewModal = (quiz: IQuiz) => {
    dispatch({ type: 'preview:open', quiz });
  };

  const openDeleteConfirm = (quiz: IQuiz) => {
    dispatch({ type: 'delete:prompt', quiz });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      dispatch({ type: 'delete:start', quizId });

      const response = await fetchApiResponse<null, { message?: string }>(
        `/api/quizzes/${quizId}`,
        {
          method: 'DELETE',
        },
      );
      dispatch({ type: 'delete:success', quizId });
      toast.success(response.meta?.message || 'Quiz deleted successfully');
    } catch (error: unknown) {
      dispatch({
        type: 'delete:error',
        error: extractUnknownErrorMessage(error, 'An error occurred while deleting the quiz'),
      });
    }
  };

  if (state.loading && state.quizzes.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          <div className="text-sm text-ink-muted">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-semibold text-ink">{t('myQuizzes')}</h2>

        <div className="flex w-full items-center gap-x-4 sm:w-auto">
          <select
            value={state.filter}
            onChange={(e) => {
              dispatch({ type: 'filter:set', filter: e.target.value as QuizFilter });
            }}
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent sm:flex-none"
          >
            <option value="all">{t('allStatus')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="published">{t('published')}</option>
            <option value="rejected">{t('rejected')}</option>
          </select>
          <Link href="/create">
            <Button>{t('newQuiz')}</Button>
          </Link>
        </div>
      </div>

      <ProfileQuizzesStats
        quizzes={state.quizzes}
        pagination={state.pagination}
        t={t}
        tCommon={tCommon}
      />

      {state.error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{state.error}</div>
        </div>
      )}

      {/* Quiz List */}
      <div className="space-y-4">
        {state.quizzes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <EmptyState
                icon={<HiOutlineDocumentText className="size-12 text-ink-muted" />}
                title={t('noQuizzes')}
                description={t('createFirst')}
                action={
                  <Link href="/create">
                    <Button>{t('createFirst')}</Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          state.quizzes.map((quiz) => (
            <ProfileQuizCard
              key={quiz._id}
              quiz={quiz}
              t={t}
              onOpenPreview={openPreviewModal}
              onOpenDeleteConfirm={openDeleteConfirm}
            />
          ))
        )}

        {state.pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Pagination
              currentPage={state.pagination.currentPage}
              totalPages={state.pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Preview and Delete Modals */}
      {state.previewQuiz && (
        <QuizPreviewModal
          isOpen
          onClose={() => dispatch({ type: 'preview:close' })}
          title={state.previewQuiz.title}
          questions={state.previewQuiz.questions}
        />
      )}

      <ConfirmModal
        isOpen={!!state.quizToDelete}
        title={t('deleteQuiz')}
        message={
          state.quizToDelete ? t('deleteQuizConfirm', { title: state.quizToDelete.title }) : ''
        }
        confirmText={tCommon('delete')}
        confirmVariant="destructive"
        isLoading={!!state.quizToDelete && state.deletingQuizId === state.quizToDelete._id}
        onCancel={() => dispatch({ type: 'delete:cancel' })}
        onConfirm={() => state.quizToDelete && handleDeleteQuiz(state.quizToDelete._id)}
      />
    </div>
  );
}
