'use client';

import type { Ref } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineDocumentText, HiOutlineSearch } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { toProfileQuizMonthGroupsViewModel } from '@/features/profile/mappers/profile-quiz.mapper';
import type {
  ProfileQuizLibraryCounts,
  ProfileQuizViewModel,
} from '@/features/profile/types/profile-quiz-view-model';
import styles from './ProfileQuizzesLayout.module.css';

interface ProfileQuizListProps {
  quizzes: ProfileQuizViewModel[];
  counts: ProfileQuizLibraryCounts | null;
  /** The trimmed search the shown results answer, or '' when none. */
  query: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMoreError: unknown;
  loadMoreRef: Ref<HTMLButtonElement>;
  onLoadMore: (focusedButton: boolean) => void;
  onClearSearch: () => void;
  onDelete: (quiz: ProfileQuizViewModel) => void;
}

function EmptyLibrary() {
  const t = useTranslations('profile');
  return (
    <div
      className={`${styles['emptyState']} relative flex flex-col items-center justify-center text-center`}
    >
      <HiOutlineDocumentText className="size-12 text-ink/25" />
      <h2 className="mt-4 text-lg font-semibold text-ink">{t('noQuizzes')}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink/70">{t('createFirst')}</p>
      <Link href="/create" className="mt-5">
        <Button>{t('newQuiz')}</Button>
      </Link>
    </div>
  );
}

function NoMatches({ query, onClearSearch }: { query: string; onClearSearch: () => void }) {
  const t = useTranslations('profile');
  return (
    <div
      className={`${styles['emptyState']} relative flex flex-col items-center justify-center text-center`}
    >
      <HiOutlineSearch className="size-12 text-ink/25" aria-hidden="true" />
      <h2 className="mt-4 max-w-full break-words text-lg font-semibold text-ink">
        {query ? t('noSearchMatches', { q: query }) : t('noFilterMatches')}
      </h2>
      {query ? (
        <Button variant="secondary" className="mt-5" onClick={onClearSearch}>
          {t('clearSearch')}
        </Button>
      ) : null}
    </div>
  );
}

/** The /my-quizzes cards, grouped by month, with their empty and Load more states (RIN-1206). */
export function ProfileQuizList({
  quizzes,
  counts,
  query,
  loading,
  loadingMore,
  hasMore,
  loadMoreError,
  loadMoreRef,
  onLoadMore,
  onClearSearch,
  onDelete,
}: ProfileQuizListProps) {
  const t = useTranslations('profile');
  const locale = useLocale();

  if (!counts) {
    return (
      <div aria-busy={loading} className="relative mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <QuizCardSkeleton key={`quiz-card-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  const groupedQuizzes = toProfileQuizMonthGroupsViewModel({ quizzes, locale });

  return (
    <div aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-60' : ''}`.trim()}>
      {counts.all === 0 ? (
        <EmptyLibrary />
      ) : groupedQuizzes.length === 0 ? (
        <NoMatches query={query} onClearSearch={onClearSearch} />
      ) : (
        <div className="relative mt-6 space-y-9">
          {groupedQuizzes.map((month) => (
            <section key={month.key} aria-labelledby={`quiz-month-${month.key}`}>
              <h2
                id={`quiz-month-${month.key}`}
                className="mb-5 text-lg font-semibold capitalize text-ink"
              >
                {month.label}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {month.quizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    quizId={quiz.id}
                    {...(quiz.ownedByMe ? { onDelete: () => onDelete(quiz) } : {})}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {loadMoreError ? (
        <ErrorState
          error={loadMoreError}
          onRetry={() => onLoadMore(false)}
          className="relative mt-6"
        />
      ) : hasMore && !loading ? (
        <div className="relative mt-8 flex justify-center">
          <Button
            ref={loadMoreRef}
            variant="secondary"
            loading={loadingMore}
            onClick={(event) => onLoadMore(document.activeElement === event.currentTarget)}
          >
            {t('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
