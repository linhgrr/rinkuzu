'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { HiOutlineSearch } from 'react-icons/hi';
import { ErrorState } from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { fetchQuizListViewModel } from '@/features/quiz/api/quiz-list-api';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import type {
  QuizListItemViewModel,
  QuizListViewModel,
} from '@/features/quiz/types/quiz-list-view-model';
import {
  buildQuizzesListApiKey,
  buildQuizzesPageQueryString,
  parseQuizzesPage,
  QUIZZES_PAGE_SIZE,
} from '@/features/quizzes/lib/quizzes-page-state';
import { useRouter } from '@/i18n/navigation';

const EMPTY_QUIZZES: QuizListItemViewModel[] = [];

function QuizGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <QuizCardSkeleton key={`quizzes-page-skeleton-${index}`} />
      ))}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  const t = useTranslations('quizzes');

  return (
    <div className="py-16 text-center">
      <HiOutlineSearch className="mx-auto mb-4 size-14 text-ink-muted" />
      <h2 className="font-home text-xl font-semibold text-ink">
        {hasQuery ? t('noResults') : t('empty')}
      </h2>
      <p className="mx-auto mt-2 max-w-lg font-home text-ink-muted">
        {hasQuery ? t('tryAdjusting') : t('emptyDescription')}
      </p>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('quizzes');

  return <ErrorState message={t('loadError')} onRetry={onRetry} />;
}

function QuizzesContent() {
  const t = useTranslations('quizzes');
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = parseQuizzesPage(searchParams.get('page'));

  const updateUrl = (next: { q?: string; page?: number }) => {
    replace(
      buildQuizzesPageQueryString({
        q: next.q ?? query,
        page: next.page ?? page,
      }),
      { scroll: false },
    );
  };

  const listKey = buildQuizzesListApiKey({
    query,
    page,
    limit: QUIZZES_PAGE_SIZE,
  });
  const {
    data,
    error,
    isLoading,
    mutate: retry,
  } = useSWR<QuizListViewModel>(listKey, fetchQuizListViewModel, {
    keepPreviousData: true,
  });
  const quizzes = data?.quizzes ?? EMPTY_QUIZZES;
  const pagination = data?.pagination;
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-app">
        <h1 className="sr-only">{t('title')}</h1>
        <div className="mt-6 space-y-6">
          <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
            <div>
              <h2 className="font-home text-xl font-semibold text-ink">{t('publicTitle')}</h2>
              <p className="mt-1 font-home text-sm text-ink-muted">{t('publicSubtitle')}</p>
            </div>
            {isLoading ? (
              <QuizGridSkeleton count={6} />
            ) : error ? (
              <SectionError onRetry={() => void retry()} />
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {quizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} quizId={quiz.id} />
                ))}
              </div>
            ) : (
              <EmptyState hasQuery={Boolean(query)} />
            )}
          </SurfaceCard>
        </div>

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex justify-center pt-6">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={(nextPage) => updateUrl({ page: nextPage })}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function QuizzesFallback() {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-app space-y-6">
        <QuizGridSkeleton count={6} />
      </div>
    </main>
  );
}

export default function QuizzesPage() {
  return (
    <Suspense fallback={<QuizzesFallback />}>
      <QuizzesContent />
    </Suspense>
  );
}
