'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import Pagination from '@/components/ui/Pagination';
import { AdminQuizzesListSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import { UserAvatar } from '@/components/user/UserAvatar';
import { getUserDisplayName } from '@/components/user/user-identity';
import type {
  AdminQuizAuthorViewModel,
  AdminQuizDetailViewModel,
  AdminQuizListItemViewModel,
  AdminQuizzesPaginationViewModel,
  AdminQuizVisibilityViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import {
  deleteAdminQuiz,
  fetchAdminQuizDetailViewModel,
  fetchAdminQuizListViewModel,
  setAdminQuizVisibility,
} from '@/features/admin/quizzes/api/admin-quizzes-api';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { ROUTES } from '@/shared/constants/routes';
import {
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
  HiOutlinePencil,
  HiOutlineTrash,
} from 'react-icons/hi';

interface State {
  quizzes: AdminQuizListItemViewModel[];
  pagination: AdminQuizzesPaginationViewModel;
  loading: boolean;
  error: string;
  searchInput: string;
  appliedSearch: string;
  visibility: AdminQuizVisibilityViewModel;
  page: number;
  previewQuiz: AdminQuizDetailViewModel | null;
  previewingQuizId: string | null;
  quizToDelete: AdminQuizListItemViewModel | null;
  deletingQuizId: string | null;
  quizToToggle: AdminQuizListItemViewModel | null;
  togglingQuizId: string | null;
}

type Action =
  | { type: 'patch'; value: Partial<State> }
  | {
      type: 'loaded';
      quizzes: AdminQuizListItemViewModel[];
      pagination: AdminQuizzesPaginationViewModel;
    }
  | { type: 'removed'; quizId: string }
  | { type: 'visibilityChanged'; quizId: string; visibility: 'public' | 'personal' };

const initialState: State = {
  quizzes: [],
  pagination: {
    page: 1,
    totalPages: 0,
    total: 0,
    limit: 12,
    hasNextPage: false,
    hasPrevPage: false,
  },
  loading: true,
  error: '',
  searchInput: '',
  appliedSearch: '',
  visibility: 'all',
  page: 1,
  previewQuiz: null,
  previewingQuizId: null,
  quizToDelete: null,
  deletingQuizId: null,
  quizToToggle: null,
  togglingQuizId: null,
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
        quizzes: state.quizzes.filter((quiz) => quiz.id !== action.quizId),
        quizToDelete: null,
        deletingQuizId: null,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      };
    case 'visibilityChanged':
      return {
        ...state,
        quizzes: state.quizzes.map((quiz) =>
          quiz.id === action.quizId
            ? { ...quiz, visibility: action.visibility, visibilityLabelKey: action.visibility }
            : quiz,
        ),
        quizToToggle: null,
        togglingQuizId: null,
      };
    default:
      return state;
  }
}

interface AdminQuizAuthorLinkProps {
  author: AdminQuizAuthorViewModel;
}

function AdminQuizAuthorLink({ author }: AdminQuizAuthorLinkProps) {
  const content = (
    <>
      <UserAvatar user={author} size={24} />
      <span className="truncate">{getUserDisplayName(author)}</span>
    </>
  );

  return (
    <Link
      href={ROUTES.USER.PROFILE(author.id)}
      className="inline-flex min-w-0 max-w-[220px] items-center gap-2 rounded-full transition hover:text-brand-trust"
    >
      {content}
    </Link>
  );
}

export function AdminQuizzesPageClient() {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadQuizzes() {
      dispatch({ type: 'patch', value: { loading: true, error: '' } });
      try {
        const data = await fetchAdminQuizListViewModel({
          page: state.page,
          limit: 12,
          search: state.appliedSearch,
          visibility: state.visibility,
          signal: controller.signal,
        });
        if (cancelled) return;
        dispatch({ type: 'loaded', quizzes: data.quizzes, pagination: data.pagination });
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        dispatch({
          type: 'patch',
          value: {
            loading: false,
            error: describeError(error, t('quizManagementLoadError')),
          },
        });
      }
    }

    void loadQuizzes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.page, state.appliedSearch, state.visibility, t, describeError]);

  const pageStats = {
    public: state.quizzes.filter((quiz) => quiz.visibility === 'public').length,
    personal: state.quizzes.filter((quiz) => quiz.visibility === 'personal').length,
  };

  async function removeQuiz(quizId: string) {
    dispatch({ type: 'patch', value: { deletingQuizId: quizId, error: '' } });
    try {
      await deleteAdminQuiz(quizId);
      dispatch({ type: 'removed', quizId });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          deletingQuizId: null,
          error: describeError(error, t('quizManagementDeleteError')),
        },
      });
    }
  }

  async function toggleVisibility(quiz: AdminQuizListItemViewModel) {
    const visibility = quiz.visibility === 'public' ? 'personal' : 'public';
    dispatch({ type: 'patch', value: { togglingQuizId: quiz.id, error: '' } });
    try {
      const result = await setAdminQuizVisibility(quiz.id, visibility);
      dispatch({ type: 'visibilityChanged', quizId: quiz.id, visibility: result.visibility });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          quizToToggle: null,
          togglingQuizId: null,
          error: describeError(error, t('quizVisibilityChangeError')),
        },
      });
    }
  }

  async function previewQuiz(quiz: AdminQuizListItemViewModel) {
    dispatch({
      type: 'patch',
      value: { previewingQuizId: quiz.id, error: '' },
    });
    try {
      const fullQuiz = await fetchAdminQuizDetailViewModel(quiz.id);
      dispatch({
        type: 'patch',
        value: { previewQuiz: fullQuiz, previewingQuizId: null },
      });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          previewingQuizId: null,
          error: describeError(error, t('quizManagementLoadError')),
        },
      });
    }
  }

  function applySearch() {
    dispatch({
      type: 'patch',
      value: { appliedSearch: state.searchInput.trim(), page: 1 },
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-8 font-home sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{t('quizManagement')}</h1>
          <p className="mt-2 text-ink/60">{t('quizManagementDescription')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[280px]">
            <AdminSearchInput
              value={state.searchInput}
              onChange={(value) => dispatch({ type: 'patch', value: { searchInput: value } })}
              placeholder={t('searchQuizzes')}
              onEnter={applySearch}
            />
          </div>
          <Select
            value={state.visibility}
            aria-label={t('allVisibility')}
            onChange={(event) =>
              dispatch({
                type: 'patch',
                value: {
                  visibility: event.target.value as AdminQuizVisibilityViewModel,
                  page: 1,
                },
              })
            }
            className="bg-surface"
          >
            <option value="all">{t('allVisibility')}</option>
            <option value="public">{t('publicQuizzes')}</option>
            <option value="personal">{t('personalQuizzes')}</option>
          </Select>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          [state.pagination.total, t('totalQuizzes')],
          [pageStats.public, t('publicOnPage')],
          [pageStats.personal, t('personalOnPage')],
        ].map(([value, label]) => (
          <SurfaceCard key={String(label)} className="p-5">
            <div className="font-home text-2xl font-semibold text-ink">{value}</div>
            <div className="mt-1 font-home text-xs text-ink-muted">{label}</div>
          </SurfaceCard>
        ))}
      </section>

      {state.error ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.error}</div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line-blue/30 bg-white">
        {state.loading ? (
          <AdminQuizzesListSkeleton />
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
                key={quiz.id}
                className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-ink">{quiz.title}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        quiz.visibility === 'personal'
                          ? 'bg-neutral-100 text-neutral-600'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {quiz.visibility === 'personal' ? (
                        <span className="inline-flex items-center gap-1">
                          <HiOutlineLockClosed className="size-3" />
                          {t('personal')}
                        </span>
                      ) : (
                        t('public')
                      )}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/55">
                    <AdminQuizAuthorLink author={quiz.author} />
                    <span>•</span>
                    <span>{t('questionTotal', { count: quiz.questionCount })}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={state.previewingQuizId === quiz.id}
                    onClick={() => void previewQuiz(quiz)}
                  >
                    <HiOutlineEye className="mr-1 size-4" />
                    {t('previewWithAnswers')}
                  </Button>
                  <Link href={ROUTES.EDIT.QUIZ(quiz.id)}>
                    <Button size="sm" variant="outline">
                      <HiOutlinePencil className="mr-1 size-4" />
                      {t('editQuiz')}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={state.togglingQuizId === quiz.id}
                    onClick={() => dispatch({ type: 'patch', value: { quizToToggle: quiz } })}
                  >
                    {quiz.visibility === 'public' ? (
                      <HiOutlineLockClosed className="mr-1 size-4" />
                    ) : (
                      <HiOutlineGlobeAlt className="mr-1 size-4" />
                    )}
                    {quiz.visibility === 'public' ? t('quizMakePrivate') : t('quizMakePublic')}
                  </Button>
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
          currentPage={state.pagination.page}
          totalPages={state.pagination.totalPages}
          onPageChange={(page) => dispatch({ type: 'patch', value: { page } })}
          className="mt-8 justify-center"
        />
      ) : null}

      {state.previewQuiz ? (
        <QuizPreviewModal
          isOpen
          previewKey={state.previewQuiz.id}
          title={state.previewQuiz.title}
          questions={state.previewQuiz.questions}
          onClose={() => dispatch({ type: 'patch', value: { previewQuiz: null } })}
        />
      ) : null}

      <ConfirmModal
        isOpen={!!state.quizToToggle}
        title={
          state.quizToToggle?.visibility === 'public'
            ? t('quizMakePrivateTitle')
            : t('quizMakePublicTitle')
        }
        message={
          state.quizToToggle
            ? state.quizToToggle.visibility === 'public'
              ? t('quizMakePrivateConfirm', { title: state.quizToToggle.title })
              : t('quizMakePublicConfirm', { title: state.quizToToggle.title })
            : ''
        }
        confirmText={
          state.quizToToggle?.visibility === 'public' ? t('quizMakePrivate') : t('quizMakePublic')
        }
        cancelText={t('cancel')}
        confirmVariant="primary"
        isLoading={state.togglingQuizId === state.quizToToggle?.id}
        onCancel={() => dispatch({ type: 'patch', value: { quizToToggle: null } })}
        onConfirm={() => state.quizToToggle && void toggleVisibility(state.quizToToggle)}
      />

      <ConfirmModal
        isOpen={!!state.quizToDelete}
        title={t('adminDeleteQuiz')}
        message={t('deleteQuizConfirm')}
        confirmText={t('deleteQuizButton')}
        cancelText={t('cancel')}
        confirmVariant="destructive"
        isLoading={state.deletingQuizId === state.quizToDelete?.id}
        onCancel={() => dispatch({ type: 'patch', value: { quizToDelete: null } })}
        onConfirm={() => state.quizToDelete && void removeQuiz(state.quizToDelete.id)}
      />
    </main>
  );
}
