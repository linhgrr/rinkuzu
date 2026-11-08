'use client';

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

interface EmptyBookmarksStateProps {
  t: TranslateFn;
}

export function BookmarksHeader({ count, t }: BookmarksHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-home text-[22px] font-semibold leading-[1.35] text-ink sm:text-2xl">
        {t('bookmarkedQuestions')}
      </h2>
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

export function StaleQuizFilterState({ onShowAll, t }: StaleQuizFilterStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <EmptyState
          icon={<HiOutlineTag className="size-12 text-neutral-400" />}
          title={t('bookmarkQuizFilterEmpty')}
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

export function EmptyBookmarksState({ t }: EmptyBookmarksStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <EmptyState
          icon={<HiOutlineTag className="size-12 text-neutral-400" />}
          title={t('noBookmarks')}
          description={t('bookmarksEmptyHint')}
          action={<EmptyStateExploreAction />}
        />
      </CardContent>
    </Card>
  );
}

export function BookmarksSkeleton() {
  return (
    <div className="space-y-4 font-home" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
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
