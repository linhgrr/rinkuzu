'use client';

import { Suspense, useReducer, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { fetchQuizListViewModel } from '@/features/quiz/api/quiz-list-api';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { HiOutlineSearch } from 'react-icons/hi';

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {skeletonKeys.map((skeletonKey) => (
        <QuizCardSkeleton key={skeletonKey} />
      ))}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations('explore');

  return (
    <div className="text-center py-20">
      <HiOutlineSearch className="size-16 text-ink-muted mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-ink">{t('noQuizzes')}</h3>
      <p className="text-ink-muted mt-2">{t('tryAdjusting')}</p>
      <Button variant="ghost" className="mt-4" onClick={onClear}>
        {t('clearFilters')}
      </Button>
    </div>
  );
}

function ExploreContent() {
  const t = useTranslations('explore');
  const locale = useLocale();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const initialSearch = get('q') ?? '';
  const [state, dispatch] = useReducer(exploreReducer, {
    page: parseInt(get('page') ?? '1', 10),
    search: initialSearch,
    committedSearch: initialSearch,
  });
  const limit = 12;

  // Sync state to URL
  const updateURL = (newSearch: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('q', newSearch);
    if (newPage > 1) params.set('page', newPage.toString());

    const queryString = params.toString();
    replace(queryString ? `?${queryString}` : '/explore', { scroll: false });
  };

  // SWR fetch — key changes trigger automatic re-fetch
  const swrParams = new URLSearchParams({
    page: state.page.toString(),
    limit: limit.toString(),
    compact: 'true',
  });
  if (state.committedSearch) swrParams.append('search', state.committedSearch);

  const { data, isLoading } = useSWR(`/api/quizzes?${swrParams}`, fetchQuizListViewModel);

  const quizzes = data?.quizzes ?? [];
  const pagination = data?.pagination ?? {
    currentPage: state.page,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: limit,
    hasNextPage: false,
    hasPrevPage: false,
  };

  // Debounce search — update committedSearch after 500ms, resetting page to 1
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
      <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Search */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
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

          {/* Quiz Grid */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : quizzes.length === 0 ? (
            <EmptyState onClear={handleClearFilters} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} quizId={quiz.id} locale={locale} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination
                currentPage={pagination.currentPage}
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
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <div className="text-center animate-pulse">
        <div className="size-12 bg-surface-warm rounded-xl mx-auto mb-4" />
        <p className="text-ink-muted">{t('loading')}</p>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <ExploreContent />
    </Suspense>
  );
}
