'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { EmptyState, EmptyStateExploreAction } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import Pagination from '@/components/ui/Pagination';
import { ROUTES } from '@/shared/constants/routes';
import { fetchProfileHistoryViewModel } from '@/features/profile/api/profile-history-api';
import type {
  ProfileHistoryAttemptViewModel,
  ProfileHistoryPaginationViewModel,
} from '@/features/profile/types/profile-history-view-model';
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineEmojiHappy,
  HiOutlineEmojiSad,
  HiOutlineThumbUp,
  HiOutlineStar,
  HiOutlineAcademicCap,
} from 'react-icons/hi';

interface ProfileHistoryState {
  attempts: ProfileHistoryAttemptViewModel[];
  loading: boolean;
  /** Load failure, rendered by ErrorState from the error layer (RIN-755). */
  error: unknown;
  currentPage: number;
  reloadKey: number;
  pagination: ProfileHistoryPaginationViewModel | null;
}

interface AttemptTakenAtProps {
  iso: string;
  label: string;
}

type ProfileHistoryAction =
  | { type: 'fetch:start' }
  | {
      type: 'fetch:success';
      attempts: ProfileHistoryAttemptViewModel[];
      pagination: ProfileHistoryPaginationViewModel;
    }
  | { type: 'fetch:error'; error: unknown }
  | { type: 'page:set'; page: number }
  | { type: 'retry' };

const ITEMS_PER_PAGE = 10;

const initialState: ProfileHistoryState = {
  attempts: [],
  loading: true,
  error: null,
  currentPage: 1,
  reloadKey: 0,
  pagination: null,
};

function profileHistoryReducer(
  state: ProfileHistoryState,
  action: ProfileHistoryAction,
): ProfileHistoryState {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true };
    case 'fetch:success':
      return {
        ...state,
        attempts: action.attempts,
        pagination: action.pagination,
        loading: false,
        error: null,
      };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    case 'page:set':
      return { ...state, currentPage: action.page, error: null };
    case 'retry':
      return { ...state, error: null, reloadKey: state.reloadKey + 1 };
    default:
      return state;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function AttemptTakenAt({ iso, label }: AttemptTakenAtProps) {
  return (
    <time dateTime={iso} className="font-home text-xs text-ink-muted">
      {label}
    </time>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6 font-home" aria-busy="true">
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SurfaceCard key={`history-stat-skeleton-${index}`} className="p-4">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="mt-2 h-7 w-16 rounded-md" />
          </SurfaceCard>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SurfaceCard key={`history-item-skeleton-${index}`} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-64 rounded-md" />
                <Skeleton className="h-4 w-36 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}

function ProfileHistory() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileHistoryReducer, initialState);

  useEffect(() => {
    let isActive = true;
    dispatch({ type: 'fetch:start' });

    void fetchProfileHistoryViewModel(
      new URLSearchParams({
        page: state.currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      }),
    )
      .then((viewModel) => {
        if (!isActive) return;
        dispatch({
          type: 'fetch:success',
          attempts: viewModel.attempts,
          pagination: viewModel.pagination,
        });
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        dispatch({ type: 'fetch:error', error });
      });

    return () => {
      isActive = false;
    };
  }, [state.currentPage, state.reloadKey]);

  const getPerformanceBadge = (score: number) => {
    if (score >= 90)
      return {
        text: t('excellent'),
        icon: <HiOutlineAcademicCap className="size-4" />,
        tone: 'warm' as const,
      };
    if (score >= 80)
      return {
        text: t('great'),
        icon: <HiOutlineStar className="size-4" />,
        tone: 'cool' as const,
      };
    if (score >= 70)
      return {
        text: t('good'),
        icon: <HiOutlineThumbUp className="size-4" />,
        tone: 'cool' as const,
      };
    if (score >= 60)
      return {
        text: t('pass'),
        icon: <HiOutlineEmojiHappy className="size-4" />,
        tone: 'neutral' as const,
      };
    return {
      text: t('needsWork'),
      icon: <HiOutlineEmojiSad className="size-4" />,
      tone: 'neutral' as const,
    };
  };

  const handlePageChange = (page: number) => {
    dispatch({ type: 'page:set', page });
  };

  if (state.loading && state.attempts.length === 0) {
    return <HistorySkeleton />;
  }

  return (
    <div className="space-y-6 font-home text-ink">
      <h2 className="font-home text-[22px] font-semibold leading-[1.35] text-ink sm:text-2xl">
        {t('quizHistory')}
      </h2>

      {state.error ? (
        <ErrorState
          error={state.error}
          onRetry={() => dispatch({ type: 'retry' })}
          className="mb-4"
        />
      ) : null}

      {state.error && state.attempts.length === 0 ? null : state.attempts.length === 0 ? (
        <SurfaceCard className="p-8 text-center">
          <EmptyState
            icon={<HiOutlineDocumentText className="size-14 text-ink-muted" />}
            title={t('noHistory')}
            description={t('historyEmptyHint')}
            action={<EmptyStateExploreAction />}
          />
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SurfaceCard className="p-4 text-center">
              <div className="font-home text-2xl font-semibold text-accent">
                {state.pagination?.totalItems ?? state.attempts.length}
              </div>
              <div className="font-home text-xs text-ink-muted mt-1">{t('totalAttempts')}</div>
            </SurfaceCard>
            <SurfaceCard className="p-4 text-center">
              <div className="font-home text-2xl font-semibold text-green-600">
                {state.attempts.length > 0
                  ? Math.round(
                      state.attempts.reduce((sum, attempt) => sum + attempt.score, 0) /
                        state.attempts.length,
                    )
                  : 0}
                %
              </div>
              <div className="font-home text-xs text-ink-muted mt-1">{t('avgScore')}</div>
            </SurfaceCard>
          </div>

          {/* Attempts List */}
          <div className="space-y-4">
            {state.attempts.map((attempt) => {
              const badge = getPerformanceBadge(attempt.score);
              return (
                <SurfaceCard key={attempt.id} className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-x-2.5 flex-wrap gap-y-1.5 mb-1.5">
                        <h3 className="font-home text-base sm:text-lg font-semibold text-ink truncate max-w-[200px] sm:max-w-md">
                          {attempt.quiz.title}
                        </h3>
                        <Pill tone={badge.tone} className="flex items-center gap-1">
                          {badge.icon} {badge.text}
                        </Pill>
                      </div>

                      <div className="flex items-center gap-x-4 font-home text-xs text-ink-muted mt-2">
                        <span className="flex items-center gap-1">
                          <HiOutlineDocumentText className="size-3.5" />{' '}
                          {tCommon('questionsCount', { count: attempt.totalQuestions })}
                        </span>
                        <span className="flex items-center gap-1">
                          <HiOutlineClock className="size-3.5" />{' '}
                          <AttemptTakenAt iso={attempt.takenAt} label={attempt.takenAtLabel} />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                      <div className="text-right sm:text-left">
                        <div
                          className={`font-home text-2xl font-bold ${getScoreColor(attempt.score)}`}
                        >
                          {attempt.score}%
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link href={ROUTES.HISTORY_DETAIL(attempt.id)}>
                          <Button variant="outline" size="sm">
                            {t('details')}
                          </Button>
                        </Link>
                        <Link href={ROUTES.QUIZ.VIEW(attempt.quiz.slug)}>
                          <Button variant="primary" size="sm">
                            {t('redo')}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          {/* Pagination */}
          {state.pagination && state.pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={state.pagination.currentPage}
                totalPages={state.pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileHistory;
