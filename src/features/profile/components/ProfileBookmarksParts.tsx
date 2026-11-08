'use client';

import type { ReactNode } from 'react';
import { HiOutlineTag } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState, EmptyStateExploreAction } from '@/components/ui/EmptyState';
import { Pill } from '@/components/ui/Pill';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ProfileBookmarkQuizListViewModel } from '@/features/profile/types/profile-bookmark-view-model';

/** Header, quiz filter and empty/loading states of the /bookmarks list (split out in RIN-1208). */

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface BookmarksHeaderProps {
  /** Bookmarks in the current (possibly filtered) list; hidden until the list arrives. */
  count: number | null;
  t: TranslateFn;
}

interface BookmarkQuizFilterProps {
  quizList: ProfileBookmarkQuizListViewModel | undefined;
  value: string;
  onChange: (quizSlug: string) => void;
  t: TranslateFn;
}

interface StaleQuizFilterStateProps {
  onShowAll: () => void;
  t: TranslateFn;
}

interface BookmarksBodyProps {
  isLoading: boolean;
  /** The list request failed (its ErrorState is shown above the body). */
  hasError: boolean;
  isEmpty: boolean;
  isFiltered: boolean;
  onShowAll: () => void;
  t: TranslateFn;
  /** The bookmark cards and pagination. */
  children: ReactNode;
}

interface BookmarksTitleProps {
  t: TranslateFn;
}

interface EmptyBookmarksStateProps {
  t: TranslateFn;
}

/** The page h1 (RIN-1200): also rendered by the first-load skeleton so it never flickers. */
function BookmarksTitle({ t }: BookmarksTitleProps) {
  return (
    <h1 className="font-home text-[22px] font-semibold leading-[1.35] text-ink sm:text-2xl">
      {t('bookmarkedQuestions')}
    </h1>
  );
}

export function BookmarksHeader({ count, t }: BookmarksHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <BookmarksTitle t={t} />
      {count !== null ? <Pill tone="neutral">{t('bookmarkCount', { count })}</Pill> : null}
    </div>
  );
}

/** "Quiz" select: All plus each quiz with bookmarks, most first; disabled until the list arrives. */
export function BookmarkQuizFilter({ quizList, value, onChange, t }: BookmarkQuizFilterProps) {
  return (
    <div className="w-full sm:max-w-[360px]">
      <Select
        label={t('bookmarkQuizFilterLabel')}
        value={value}
        disabled={!quizList}
        onChange={(event) => onChange(event.target.value)}
        className="truncate"
      >
        <option value="">{t('bookmarkQuizFilterAll', { count: quizList?.total ?? 0 })}</option>
        {quizList?.quizzes.map((quiz) => (
          <option key={quiz.slug} value={quiz.slug} title={quiz.title}>
            {`${quiz.title} (${quiz.count})`}
          </option>
        ))}
      </Select>
    </div>
  );
}

function StaleQuizFilterState({ onShowAll, t }: StaleQuizFilterStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <EmptyState
          icon={<HiOutlineTag className="size-12 text-neutral-400" />}
          title={t('bookmarkQuizFilterEmpty')}
          headingLevel={2}
          action={
            <Button variant="outline" size="sm" onClick={onShowAll} className="font-home">
              {t('bookmarkQuizFilterShowAll')}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

function EmptyBookmarksState({ t }: EmptyBookmarksStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <EmptyState
          icon={<HiOutlineTag className="size-12 text-neutral-400" />}
          title={t('noBookmarks')}
          headingLevel={2}
          description={t('bookmarksEmptyHint')}
          action={<EmptyStateExploreAction />}
        />
      </CardContent>
    </Card>
  );
}

/** Card placeholders only: shown under the header and filter while a page loads. */
function BookmarksListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" data-testid="bookmarks-list-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <SurfaceCard key={`bookmark-skeleton-${index}`} className="p-5">
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}

/** First load only: the real h1, a count placeholder and the card placeholders. */
export function BookmarksSkeleton({ t }: BookmarksTitleProps) {
  return (
    <div className="space-y-4 font-home" aria-busy="true">
      <div className="flex items-center justify-between">
        <BookmarksTitle t={t} />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <BookmarksListSkeleton />
    </div>
  );
}

/** The list region under the header and filter: card skeleton, empty states or the cards. */
export function BookmarksBody({
  isLoading,
  hasError,
  isEmpty,
  isFiltered,
  onShowAll,
  t,
  children,
}: BookmarksBodyProps) {
  if (isLoading) {
    return <BookmarksListSkeleton />;
  }
  if (!isEmpty) {
    return <div className="space-y-6">{children}</div>;
  }
  if (hasError) {
    return null;
  }
  return isFiltered ? (
    <StaleQuizFilterState onShowAll={onShowAll} t={t} />
  ) : (
    <EmptyBookmarksState t={t} />
  );
}
