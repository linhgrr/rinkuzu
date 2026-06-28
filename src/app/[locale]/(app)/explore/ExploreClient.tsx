'use client';

import { Suspense, useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { fetchApiData } from '@/lib/api/client';
import { HiOutlineSearch } from '@/components/icons';
import type { IQuiz } from '@/types';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ExploreData = {
  quizzes: IQuiz[];
  pagination: PaginationData;
};

interface ExploreState {
  page: number;
  search: string;
  committedSearch: string;
}

type ExploreAction =
  | { type: 'page:set'; page: number }
  | { type: 'search:set'; search: string }
  | { type: 'search:commit' }
  | { type: 'filters:clear' };

function exploreReducer(state: ExploreState, action: ExploreAction): ExploreState {
  switch (action.type) {
    case 'page:set':
      return { ...state, page: action.page };
    case 'search:set':
      return { ...state, search: action.search };
    case 'search:commit':
      return { ...state, committedSearch: state.search, page: 1 };
    case 'filters:clear':
      return { ...state, search: '', committedSearch: '', page: 1 };
    default:
      return state;
  }
}

function LoadingSkeleton() {
  const skeletonKeys = ['quiz-1', 'quiz-2', 'quiz-3', 'quiz-4', 'quiz-5', 'quiz-6'];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {skeletonKeys.map((skeletonKey) => (
        <QuizCardSkeleton key={skeletonKey} />
      ))}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations('explore');

  return (
    <div className="py-20 text-center">
      <HiOutlineSearch className="mx-auto mb-4 size-16 text-ink-muted" />
      <h3 className="text-xl font-semibold text-ink">{t('noQuizzes')}</h3>
      <p className="mt-2 text-ink-muted">{t('tryAdjusting')}</p>
      <Button variant="ghost" className="mt-4" onClick={onClear}>
        {t('clearFilters')}
      </Button>
    </div>
  );
}

function ExploreContent({
  initialData,
  initialPage,
  initialSearch,
}: {
  initialData: ExploreData;
  initialPage: number;
  initialSearch: string;
}) {
  const t = useTranslations('explore');
  const locale = useLocale();
  const { replace } = useRouter();
  const [state, dispatch] = useReducer(exploreReducer, {
    page: initialPage,
    search: initialSearch,
    committedSearch: initialSearch,
  });
  const limit = 12;

  const updateURL = (newSearch: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('q', newSearch);
    if (newPage > 1) params.set('page', newPage.toString());

    const queryString = params.toString();
    replace(queryString ? `?${queryString}` : '/explore', { scroll: false });
  };

  const swrParams = new URLSearchParams({
    page: state.page.toString(),
    limit: limit.toString(),
    compact: 'true',
  });
  if (state.committedSearch) swrParams.append('search', state.committedSearch);

  const swrKey = `/api/quizzes?${swrParams}`;
  const isInitialQuery = state.page === initialPage && state.committedSearch === initialSearch;
  const { data, isLoading } = useSWR(swrKey, fetchApiData<ExploreData>, {
    fallbackData: isInitialQuery ? initialData : undefined,
    keepPreviousData: true,
  });

  const quizzes = data?.quizzes ?? [];
  const pagination = data?.pagination ?? { page: state.page, limit, total: 0, totalPages: 0 };

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'search:commit' });
    }, 500);
    return () => clearTimeout(timer);
  }, [state.search]);

  const handlePageChange = (newPage: number) => {
    dispatch({ type: 'page:set', page: newPage });
    updateURL(state.search, newPage);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    dispatch({ type: 'search:set', search: newSearch });
    updateURL(newSearch, 1);
  };

  const handleClearFilters = () => {
    dispatch({ type: 'filters:clear' });
    updateURL('', 1);
  };

  return (
    <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
      <main className="px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 space-y-4">
            <div className="flex flex-col items-start justify-end gap-4 md:flex-row md:items-center">
              <div className="w-full md:w-auto">
                <div className="w-full sm:w-64">
                  <Input
                    type="text"
                    name="search"
                    autoComplete="off"
                    placeholder={t('searchPlaceholder')}
                    value={state.search}
                    onChange={handleSearchChange}
                    aria-label={t('searchPlaceholder')}
                  />
                </div>
              </div>
            </div>
          </div>

          {isLoading && quizzes.length === 0 ? (
            <LoadingSkeleton />
          ) : quizzes.length === 0 ? (
            <EmptyState onClear={handleClearFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz._id} quiz={quiz} locale={locale} />
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ExploreFallback() {
  const t = useTranslations('common');

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <div className="animate-pulse text-center">
        <div className="mx-auto mb-4 size-12 rounded-xl bg-surface-warm" />
        <p className="text-ink-muted">{t('loading')}</p>
      </div>
    </div>
  );
}

export function ExploreClient({
  initialData,
  initialPage,
  initialSearch,
}: {
  initialData: ExploreData;
  initialPage: number;
  initialSearch: string;
}) {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <ExploreContent
        initialData={initialData}
        initialPage={initialPage}
        initialSearch={initialSearch}
      />
    </Suspense>
  );
}
