'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { EmptyState, EmptyStateExploreAction } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import Pagination from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ROUTES } from '@/shared/constants/routes';
import { ATTEMPT_PASS_MARK, type AttemptResultFilter } from '@/shared/constants/attempt-result';
import { fetchProfileHistoryViewModel } from '@/features/profile/api/profile-history-api';
import type {
  ProfileHistoryAttemptViewModel,
  ProfileHistoryPaginationViewModel,
  ProfileHistorySummaryViewModel,
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

type HistoryFilter = 'all' | AttemptResultFilter;

interface ProfileHistoryState {
  attempts: ProfileHistoryAttemptViewModel[];
  loading: boolean;
  /** Load failure, rendered by ErrorState from the error layer (RIN-755). */
  error: unknown;
  currentPage: number;
  filter: HistoryFilter;
  reloadKey: number;
  pagination: ProfileHistoryPaginationViewModel | null;
  /** All-attempts stats from the API; `null` until the first successful load (RIN-1204). */
  summary: ProfileHistorySummaryViewModel | null;
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
      summary: ProfileHistorySummaryViewModel;
    }
  | { type: 'fetch:error'; error: unknown }
  | { type: 'page:set'; page: number }
  | { type: 'filter:set'; filter: HistoryFilter }
  | { type: 'retry' };

const ITEMS_PER_PAGE = 10;

const initialState: ProfileHistoryState = {
  attempts: [],
  loading: true,
  error: null,
  currentPage: 1,
  filter: 'all',
  reloadKey: 0,
  pagination: null,
  summary: null,
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
        summary: action.summary,
        loading: false,
        error: null,
      };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    case 'page:set':
      return { ...state, currentPage: action.page, error: null };
    case 'filter:set':
      return action.filter === state.filter
        ? state
        : { ...state, filter: action.filter, currentPage: 1, error: null };
    case 'retry':
      return { ...state, error: null, reloadKey: state.reloadKey + 1 };
    default:
      return state;
  }
}

function buildHistoryParams(page: number, filter: HistoryFilter): URLSearchParams {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: ITEMS_PER_PAGE.toString(),
  });
  if (filter !== 'all') params.set('result', filter);
  return params;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= ATTEMPT_PASS_MARK) return 'text-amber-600';
  return 'text-red-600';
}

function AttemptTakenAt({ iso, label }: AttemptTakenAtProps) {
  return (
    <time dateTime={iso} className="font-home text-xs text-ink-muted">
      {label}
    </time>
  );
}

/** The page's one h1, shown in the loading, empty, error and list states (RIN-1200). */
function HistoryTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-home text-[22px] font-semibold leading-[1.35] text-ink sm:text-2xl">
      {children}
    </h1>
  );
}

function HistorySkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6 font-home" aria-busy="true">
      <HistoryTitle>{title}</HistoryTitle>
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

function HistoryListSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <SurfaceCard key={`history-list-skeleton-${index}`} className="p-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 max-w-full rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
          </div>
        </SurfaceCard>
      ))}
    </>
  );
}

interface HistoryStatsProps {
  summary: ProfileHistorySummaryViewModel;
}

/** Stats over all attempts: they do not follow the filter or the page (RIN-1204). */
function HistoryStats({ summary }: HistoryStatsProps) {
  const t = useTranslations('profile');
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <SurfaceCard className="p-4 text-center">
        <div className="font-home text-2xl font-semibold text-accent">{summary.totalAttempts}</div>
        <div className="font-home text-xs text-ink-muted mt-1">{t('totalAttempts')}</div>
      </SurfaceCard>
      <SurfaceCard className="p-4 text-center">
        <div className="font-home text-2xl font-semibold text-green-600">
          {summary.averageScore === null ? '–' : `${summary.averageScore}%`}
        </div>
        <div className="font-home text-xs text-ink-muted mt-1">{t('avgScore')}</div>
      </SurfaceCard>
      <SurfaceCard className="col-span-2 p-4 text-center sm:col-span-1">
        <div className="font-home text-2xl font-semibold text-ink">{summary.needsWorkCount}</div>
        <div className="font-home text-xs text-ink-muted mt-1">{t('historyNeedsWorkCount')}</div>
      </SurfaceCard>
    </div>
  );
}

function ProfileHistory() {
  const locale = useLocale();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileHistoryReducer, initialState);

  useEffect(() => {
    let isActive = true;
    dispatch({ type: 'fetch:start' });

    void fetchProfileHistoryViewModel(buildHistoryParams(state.currentPage, state.filter), locale)
      .then((viewModel) => {
        if (!isActive) return;
        dispatch({
          type: 'fetch:success',
          attempts: viewModel.attempts,
          pagination: viewModel.pagination,
          summary: viewModel.summary,
        });
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        dispatch({ type: 'fetch:error', error });
      });

    return () => {
      isActive = false;
    };
  }, [state.currentPage, state.filter, state.reloadKey, locale]);

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
    if (score >= ATTEMPT_PASS_MARK)
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

  const filterOptions = [
    { value: 'all', label: t('historyFilterAll') },
    { value: 'needs_work', label: t('historyFilterNeedsWork') },
    { value: 'passed', label: t('historyFilterPassed') },
  ] as const;

  const handleFilterChange = (filter: HistoryFilter) => {
    dispatch({ type: 'filter:set', filter });
  };

  if (state.loading && state.summary === null) {
    return <HistorySkeleton title={t('quizHistory')} />;
  }

  const hasAnyAttempt = (state.summary?.totalAttempts ?? 0) > 0;

  return (
    <div className="space-y-6 font-home text-ink">
      <HistoryTitle>{t('quizHistory')}</HistoryTitle>

      {state.error ? (
        <ErrorState
          error={state.error}
          onRetry={() => dispatch({ type: 'retry' })}
          className="mb-4"
        />
      ) : null}

      {state.summary === null ? null : !hasAnyAttempt ? (
        <SurfaceCard className="p-8 text-center">
          <EmptyState
            icon={<HiOutlineDocumentText className="size-14 text-ink-muted" />}
            title={t('noHistory')}
            headingLevel={2}
            description={t('historyEmptyHint')}
            action={<EmptyStateExploreAction />}
          />
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          <HistoryStats summary={state.summary} />

          {/* Scrolls sideways on its own if the vi labels do not fit at 375 px (RIN-1204). */}
          <div className="-mx-1 max-w-full overflow-x-auto px-1 py-1">
            <SegmentedControl
              ariaLabel={t('historyFilterLabel')}
              value={state.filter}
              options={filterOptions}
              onChange={handleFilterChange}
            />
          </div>

          {/* Attempts List */}
          <div className="space-y-4" aria-busy={state.loading}>
            {state.loading ? (
              <HistoryListSkeleton />
            ) : state.attempts.length === 0 && !state.error ? (
              <SurfaceCard className="p-6">
                <EmptyState
                  className="py-6"
                  headingLevel={2}
                  icon={<HiOutlineDocumentText className="size-10 text-ink-muted" />}
                  title={
                    state.filter === 'passed' ? t('historyEmptyPassed') : t('historyEmptyNeedsWork')
                  }
                  action={
                    <Button variant="outline" size="sm" onClick={() => handleFilterChange('all')}>
                      {t('historyShowAll')}
                    </Button>
                  }
                />
              </SurfaceCard>
            ) : (
              state.attempts.map((attempt) => {
                const badge = getPerformanceBadge(attempt.score);
                return (
                  <SurfaceCard key={attempt.id} className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-x-2.5 flex-wrap gap-y-1.5 mb-1.5">
                          <h2 className="font-home text-base sm:text-lg font-semibold text-ink truncate max-w-[200px] sm:max-w-md">
                            {attempt.quiz.title}
                          </h2>
                          <Pill
                            tone={badge.tone}
                            className="flex shrink-0 items-center gap-1 whitespace-nowrap"
                          >
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
              })
            )}
          </div>

          {/* Pagination */}
          {!state.loading && state.pagination && state.pagination.totalPages > 1 && (
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
