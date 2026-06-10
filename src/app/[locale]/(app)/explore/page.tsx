'use client';

import { Suspense, useReducer, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import CategorySearch from '@/features/categories/components/CategorySearch';
import { formatDisplayDate } from '@/shared/utils/date';
import { fetchApiData } from '@/lib/api/client';
import {
  HiOutlineSearch,
  HiOutlineQuestionMarkCircle,
  HiOutlineArrowRight,
  HiOutlineX,
} from '@/components/icons';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    _id: string;
    name: string;
    color: string;
  };
  createdAt: string;
  questions: unknown[];
  questionCount?: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ExploreState {
  page: number;
  search: string;
  committedSearch: string;
  categoryId: string | null;
}

type ExploreAction =
  | { type: 'page:set'; page: number }
  | { type: 'search:set'; search: string }
  | { type: 'search:commit' }
  | { type: 'filters:clear' }
  | { type: 'category:set'; categoryId: string | null };

function exploreReducer(state: ExploreState, action: ExploreAction): ExploreState {
  switch (action.type) {
    case 'page:set':
      return { ...state, page: action.page };
    case 'search:set':
      return { ...state, search: action.search };
    case 'search:commit':
      return { ...state, committedSearch: state.search, page: 1 };
    case 'filters:clear':
      return { ...state, search: '', committedSearch: '', categoryId: null, page: 1 };
    case 'category:set':
      return { ...state, categoryId: action.categoryId, page: 1 };
    default:
      return state;
  }
}

const CategoryBadgeVariant = (color: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-neutral-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };
  return map[color] || 'default';
};

interface QuizCardProps {
  quiz: Quiz;
  href: string;
}

const QuizCard = memo(function QuizCard({ quiz, href }: QuizCardProps) {
  const tQuiz = useTranslations('quiz');
  const questionCount = quiz.questionCount ?? quiz.questions.length;

  return (
    <Link href={href} className="block h-full focus-visible:outline-none">
      <Card
        className="group flex h-full cursor-pointer flex-col transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg-page)]"
        aria-label={`Open quiz: ${quiz.title}`}
      >
        <CardHeader className="pb-2">
          <div className="mb-2 flex items-start justify-between">
            <Badge variant={CategoryBadgeVariant(quiz.category?.color)}>
              {quiz.category?.name || 'General'}
            </Badge>
            <span className="text-xs text-neutral-400">{formatDisplayDate(quiz.createdAt)}</span>
          </div>
          <CardTitle className="line-clamp-2 transition-colors group-hover:text-brand-trust">
            {quiz.title}
          </CardTitle>
          <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto pt-0">
          <div className="mt-2 flex items-center justify-between border-t pt-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              <HiOutlineQuestionMarkCircle className="size-4" /> {questionCount}{' '}
              {tQuiz('questions')}
            </span>
            <span className="flex items-center gap-1 font-medium text-brand-trust group-hover:underline">
              {tQuiz('takeQuiz')} <HiOutlineArrowRight className="size-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
  const skeletonKeys = ['quiz-1', 'quiz-2', 'quiz-3', 'quiz-4', 'quiz-5', 'quiz-6'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {skeletonKeys.map((skeletonKey) => (
        <Card key={skeletonKey} className="animate-pulse">
          <div className="h-48 bg-neutral-200 rounded-t-xl"></div>
          <CardContent className="p-4 space-y-3">
            <div className="h-6 bg-neutral-200 rounded w-3/4"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations('explore');

  return (
    <div className="text-center py-20">
      <HiOutlineSearch className="size-16 text-neutral-300 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-neutral-900">{t('noQuizzes')}</h3>
      <p className="text-neutral-500 mt-2">{t('tryAdjusting')}</p>
      <Button variant="ghost" className="mt-4" onClick={onClear}>
        {t('clearFilters')}
      </Button>
    </div>
  );
});

function ExploreContent() {
  const t = useTranslations('explore');
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const initialSearch = get('q') || '';
  const [state, dispatch] = useReducer(exploreReducer, {
    page: parseInt(get('page') || '1', 10),
    search: initialSearch,
    committedSearch: initialSearch,
    categoryId: get('category') || null,
  });
  const limit = 12;

  // Sync state to URL
  const updateURL = useCallback(
    (newSearch: string, newCategory: string | null, newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set('q', newSearch);
      if (newCategory) params.set('category', newCategory);
      if (newPage > 1) params.set('page', newPage.toString());

      const queryString = params.toString();
      replace(queryString ? `?${queryString}` : '/explore', { scroll: false });
    },
    [replace],
  );

  // SWR fetch — key changes trigger automatic re-fetch
  const swrParams = new URLSearchParams({
    page: state.page.toString(),
    limit: limit.toString(),
    status: 'published',
    compact: 'true',
  });
  if (state.committedSearch) swrParams.append('search', state.committedSearch);
  if (state.categoryId) swrParams.append('category', state.categoryId);

  const { data, isLoading } = useSWR(
    `/api/quizzes?${swrParams}`,
    fetchApiData<{ quizzes: Quiz[]; pagination: PaginationData }>,
  );

  const quizzes = data?.quizzes ?? [];
  const pagination = data?.pagination ?? { page: state.page, limit, total: 0, totalPages: 0 };

  // Debounce search — update committedSearch after 500ms, resetting page to 1
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'search:commit' });
    }, 500);
    return () => clearTimeout(timer);
  }, [state.search]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      dispatch({ type: 'page:set', page: newPage });
      updateURL(state.search, state.categoryId, newPage);
    },
    [state.search, state.categoryId, updateURL],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearch = e.target.value;
      dispatch({ type: 'search:set', search: newSearch });
      updateURL(newSearch, state.categoryId, 1);
    },
    [state.categoryId, updateURL],
  );

  const handleClearFilters = useCallback(() => {
    dispatch({ type: 'filters:clear' });
    updateURL('', null, 1);
  }, [updateURL]);

  const handleClearCategory = useCallback(() => {
    dispatch({ type: 'category:set', categoryId: null });
    updateURL(state.search, null, 1);
  }, [state.search, updateURL]);

  const handleCategoryChange = useCallback(
    (newCategoryId: string | null) => {
      dispatch({ type: 'category:set', categoryId: newCategoryId });
      updateURL(state.search, newCategoryId, 1);
    },
    [state.search, updateURL],
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
      <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Search */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
              <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
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
                <div className="w-full sm:w-64 relative z-20">
                  <CategorySearch showInHomepage={true} onCategorySelect={handleCategoryChange} />
                </div>
              </div>
            </div>

            {state.categoryId && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-200"
                  onClick={handleClearCategory}
                  aria-label={t('clearCategoryFilter')}
                >
                  {t('categoryFilterActive')}{' '}
                  <HiOutlineX className="inline-block ml-1" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          {/* Quiz Grid */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : quizzes.length === 0 ? (
            <EmptyState onClear={handleClearFilters} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz._id} quiz={quiz} href={`/quiz/${quiz.slug}`} />
              ))}
            </div>
          )}

          {/* Pagination */}
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center animate-pulse">
        <div className="size-12 bg-neutral-200 rounded-xl mx-auto mb-4" />
        <p className="text-[var(--text-muted)]">{t('loading')}</p>
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
