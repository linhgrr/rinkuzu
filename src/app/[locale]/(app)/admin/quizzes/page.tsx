'use client';

import { useEffect, useReducer } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import { fetchApiData } from '@/lib/api/client';
import { IQuiz, PaginationMeta } from '@/types';
import {
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineLockClosed,
  HiOutlinePencil,
  HiOutlineSearch,
  HiOutlineTrash,
} from '@/components/icons';

type VisibilityFilter = 'all' | 'public' | 'private';

interface State {
  quizzes: IQuiz[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string;
  search: string;
  visibility: VisibilityFilter;
  page: number;
  previewQuiz: IQuiz | null;
  previewingQuizId: string | null;
  quizToDelete: IQuiz | null;
  deletingQuizId: string | null;
}

type Action =
  | { type: 'patch'; value: Partial<State> }
  | { type: 'loaded'; quizzes: IQuiz[]; pagination: PaginationMeta }
  | { type: 'removed'; quizId: string };

const initialState: State = {
  quizzes: [],
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 12,
    hasNextPage: false,
    hasPrevPage: false,
  },
  loading: true,
  error: '',
  search: '',
  visibility: 'all',
  page: 1,
  previewQuiz: null,
  previewingQuizId: null,
  quizToDelete: null,
  deletingQuizId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loaded':
      return {
        ...state,
        quizzes: action.quizzes,
        pagination: action.pagination,
        loading: false,
        error: '',
      };
    case 'removed':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz._id !== action.quizId),
        quizToDelete: null,
        deletingQuizId: null,
        pagination: {
          ...state.pagination,
          totalItems: Math.max(0, state.pagination.totalItems - 1),
        },
      };
    default:
      return state;
  }
}

function questionCount(quiz: IQuiz): number {
  return (quiz as IQuiz & { questionCount?: number }).questionCount ?? quiz.questions.length;
}

export default function AdminQuizManagementPage() {
  const t = useTranslations('admin');
  const tProfile = useTranslations('profile');
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      dispatch({ type: 'patch', value: { loading: true, error: '' } });
      try {
        const params = new URLSearchParams({
          page: String(state.page),
          limit: '12',
          compact: 'true',
        });
        if (state.search.trim()) params.set('search', state.search.trim());
        if (state.visibility !== 'all') {
          params.set('visibility', state.visibility);
        }

        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationMeta }>(
          `/api/quizzes?${params}`,
        );
        dispatch({ type: 'loaded', quizzes: data.quizzes, pagination: data.pagination });
      } catch (error) {
        dispatch({
          type: 'patch',
          value: {
            loading: false,
            error: error instanceof Error ? error.message : t('quizManagementLoadError'),
          },
        });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [state.page, state.search, state.visibility, t]);

  const pageStats = {
    public: state.quizzes.filter((quiz) => !quiz.isPrivate).length,
    private: state.quizzes.filter((quiz) => quiz.isPrivate).length,
  };

  async function deleteQuiz(quizId: string) {
    dispatch({ type: 'patch', value: { deletingQuizId: quizId, error: '' } });
    try {
      await fetchApiData<null>(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      dispatch({ type: 'removed', quizId });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          deletingQuizId: null,
          error: error instanceof Error ? error.message : t('quizManagementDeleteError'),
        },
      });
    }
  }

  async function previewQuiz(quiz: IQuiz) {
    dispatch({
      type: 'patch',
      value: { previewingQuizId: quiz._id, error: '' },
    });
    try {
      const fullQuiz = await fetchApiData<IQuiz>(`/api/quizzes/${quiz._id}`);
      dispatch({
        type: 'patch',
        value: { previewQuiz: fullQuiz, previewingQuizId: null },
      });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          previewingQuizId: null,
          error: error instanceof Error ? error.message : t('quizManagementLoadError'),
        },
      });
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-8 font-home sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{t('quizManagement')}</h1>
          <p className="mt-2 text-ink/60">{t('quizManagementDescription')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-[280px] items-center gap-2 rounded-xl border border-line bg-white px-3">
            <HiOutlineSearch className="size-5 text-ink/40" />
            <input
              value={state.search}
              onChange={(event) =>
                dispatch({ type: 'patch', value: { search: event.target.value, page: 1 } })
              }
              placeholder={t('searchQuizzes')}
              className="min-h-11 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select
            value={state.visibility}
            onChange={(event) =>
              dispatch({
                type: 'patch',
                value: { visibility: event.target.value as VisibilityFilter, page: 1 },
              })
            }
            className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="all">{t('allVisibility')}</option>
            <option value="public">{t('publicQuizzes')}</option>
            <option value="private">{t('privateQuizzes')}</option>
          </select>
        </div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          [state.pagination.totalItems, t('totalQuizzes')],
          [pageStats.public, t('publicOnPage')],
          [pageStats.private, t('privateOnPage')],
        ].map(([value, label]) => (
          <div key={String(label)} className="rounded-2xl border border-line-blue/30 bg-white p-5">
            <div className="text-2xl font-semibold text-ink">{value}</div>
            <div className="mt-1 text-sm text-ink/55">{label}</div>
          </div>
        ))}
      </section>

      {state.error ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.error}</div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line-blue/30 bg-white">
        {state.loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-blue" />
            ))}
          </div>
        ) : state.quizzes.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <HiOutlineDocumentText className="size-12 text-ink/25" />
            <h2 className="mt-4 text-lg font-semibold text-ink">{t('noQuizzesFound')}</h2>
            <p className="mt-1 text-sm text-ink/50">{t('noQuizzesCreated')}</p>
          </div>
        ) : (
          <div className="divide-y divide-line-blue/25">
            {state.quizzes.map((quiz) => (
              <article
                key={quiz._id}
                className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-ink">{quiz.title}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        quiz.isPrivate
                          ? 'bg-neutral-100 text-neutral-600'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {quiz.isPrivate ? (
                        <span className="inline-flex items-center gap-1">
                          <HiOutlineLockClosed className="size-3" />
                          {tProfile('private')}
                        </span>
                      ) : (
                        t('public')
                      )}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/55">
                    <UserProfileLink
                      user={quiz.author as any}
                      avatarSize={24}
                      className="max-w-[220px]"
                    />
                    <span>•</span>
                    <span>{t('questionTotal', { count: questionCount(quiz) })}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={state.previewingQuizId === quiz._id}
                    onClick={() => void previewQuiz(quiz)}
                  >
                    <HiOutlineEye className="mr-1 size-4" />
                    {t('previewWithAnswers')}
                  </Button>
                  <Link href={`/edit/${quiz._id}`}>
                    <Button size="sm" variant="outline">
                      <HiOutlinePencil className="mr-1 size-4" />
                      {t('editQuiz')}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
                    onClick={() => dispatch({ type: 'patch', value: { quizToDelete: quiz } })}
                  >
                    <HiOutlineTrash className="mr-1 size-4" />
                    {t('delete')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {state.pagination.totalPages > 1 ? (
        <Pagination
          currentPage={state.pagination.currentPage}
          totalPages={state.pagination.totalPages}
          onPageChange={(page) => dispatch({ type: 'patch', value: { page } })}
          className="mt-8 justify-center"
        />
      ) : null}

      {state.previewQuiz ? (
        <QuizPreviewModal
          isOpen
          title={state.previewQuiz.title}
          questions={state.previewQuiz.questions}
          onClose={() => dispatch({ type: 'patch', value: { previewQuiz: null } })}
        />
      ) : null}

      <ConfirmModal
        isOpen={!!state.quizToDelete}
        title={t('adminDeleteQuiz')}
        message={t('deleteQuizConfirm')}
        confirmText={t('deleteQuizButton')}
        cancelText={t('cancel')}
        confirmVariant="destructive"
        isLoading={state.deletingQuizId === state.quizToDelete?._id}
        onCancel={() => dispatch({ type: 'patch', value: { quizToDelete: null } })}
        onConfirm={() => state.quizToDelete && void deleteQuiz(state.quizToDelete._id)}
      />
    </main>
  );
}
