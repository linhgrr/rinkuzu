'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { HiOutlineSearch } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { LibraryCardSkeleton, SubjectCard } from '@/components/adaptive/sections/Library';
import { fetchQuizListViewModel } from '@/features/quiz/api/quiz-list-api';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import type {
  QuizListItemViewModel,
  QuizListViewModel,
} from '@/features/quiz/types/quiz-list-view-model';
import { getSubjects } from '@/features/adaptive/lib/adaptive-api-methods';
import { toDashboardSubject } from '@/features/adaptive/mappers/dashboard.mapper';
import { useStartAdaptiveSubject } from '@/features/adaptive/hooks/use-start-adaptive-subject';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import { ExploreSearchInput } from '@/features/explore/components/ExploreSearchInput';
import {
  buildQuizSearchKey,
  filterAdaptiveSubjects,
  parseQuizVisibility,
  parseSearchPage,
  parseSearchType,
  type QuizVisibilityFilter,
  type SearchType,
} from '@/features/explore/lib/search';

const SEARCH_TYPES: SearchType[] = ['all', 'mine', 'adaptive', 'quizzes'];
const ALL_SECTION_LIMIT = 4;
const PAGE_SIZE = 12;
const EMPTY_QUIZZES: QuizListItemViewModel[] = [];

function QuizGridSkeleton({ count = ALL_SECTION_LIMIT }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <QuizCardSkeleton key={`quiz-search-skeleton-${index}`} />
      ))}
    </div>
  );
}

function AdaptiveGridSkeleton({ count = ALL_SECTION_LIMIT }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <LibraryCardSkeleton key={`adaptive-search-skeleton-${index}`} />
      ))}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  const t = useTranslations('explore');

  return (
    <div className="py-16 text-center">
      <HiOutlineSearch className="mx-auto mb-4 size-14 text-ink-muted" />
      <h2 className="font-home text-xl font-semibold text-ink">
        {hasQuery ? t('noResults') : t('nothingToExplore')}
      </h2>
      <p className="mx-auto mt-2 max-w-lg font-home text-ink-muted">
        {hasQuery ? t('tryAdjusting') : t('nothingToExploreDescription')}
      </p>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('explore');

  return (
    <div className="rounded-xl border border-line-blue/30 bg-surface-blue p-4">
      <p className="font-home text-sm text-ink">{t('partialError')}</p>
      <Button
        variant="ghost"
        className="mt-2 text-accent hover:text-accent-hover"
        onClick={onRetry}
      >
        {t('retry')}
      </Button>
    </div>
  );
}

function QuizResults({ quizzes }: { quizzes: QuizListItemViewModel[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} quizId={quiz.id} />
      ))}
    </div>
  );
}

function AdaptiveResults({
  subjects,
  loadingJobId,
  onOpenSubject,
}: {
  subjects: DashboardSubject[];
  loadingJobId: string | null;
  onOpenSubject: (jobId: string) => void;
}) {
  const t = useTranslations('adaptiveLearning.dashboard');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {subjects.map((subject) => (
        <SubjectCard
          key={subject.jobId}
          subject={subject}
          loading={loadingJobId === subject.jobId}
          deleting={false}
          busy={loadingJobId !== null}
          onOpenSubject={onOpenSubject}
          t={t}
        />
      ))}
    </div>
  );
}

function ExploreContent() {
  const t = useTranslations('explore');
  const tAdaptive = useTranslations('adaptiveLearning');
  const tAdaptiveDashboard = useTranslations('adaptiveLearning.dashboard');
  const locale = useLocale();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const activeType = parseSearchType(searchParams.get('type'));
  const activeVisibility = parseQuizVisibility(searchParams.get('visibility'));
  const page = parseSearchPage(searchParams.get('page'));
  const { loadingJobId, startSubject } = useStartAdaptiveSubject({
    t: tAdaptiveDashboard,
    tAdaptive,
  });

  const updateUrl = (next: {
    q?: string;
    type?: SearchType;
    page?: number;
    visibility?: QuizVisibilityFilter;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = next.q ?? query;
    const nextType = next.type ?? activeType;
    const nextPage = next.page ?? page;
    const nextVisibility = next.visibility ?? activeVisibility;

    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    else params.delete('q');
    if (nextType === 'all') params.delete('type');
    else params.set('type', nextType);
    if (nextPage > 1) params.set('page', String(nextPage));
    else params.delete('page');
    if (nextType === 'quizzes' && nextVisibility !== 'all') {
      params.set('visibility', nextVisibility);
    } else {
      params.delete('visibility');
    }

    const queryString = params.toString();
    replace(queryString ? `?${queryString}` : '?', { scroll: false });
  };

  const quizLimit = activeType === 'all' ? ALL_SECTION_LIMIT : PAGE_SIZE;
  const quizPage = activeType === 'all' ? 1 : page;
  const needsOwned = activeType === 'all' || activeType === 'mine';
  const needsCommunity = activeType === 'all' || activeType === 'quizzes';
  const needsAdaptive = activeType === 'all' || activeType === 'adaptive';

  const ownedKey = needsOwned
    ? buildQuizSearchKey({ query, page: quizPage, mine: true, limit: quizLimit })
    : null;
  const communityKey = needsCommunity
    ? buildQuizSearchKey({
        query,
        page: quizPage,
        mine: false,
        limit: quizLimit,
        visibility: activeType === 'quizzes' ? activeVisibility : 'all',
      })
    : null;

  const {
    data: ownedData,
    error: ownedError,
    isLoading: ownedLoading,
    mutate: retryOwned,
  } = useSWR<QuizListViewModel>(ownedKey, fetchQuizListViewModel, { keepPreviousData: true });
  const {
    data: communityData,
    error: communityError,
    isLoading: communityLoading,
    mutate: retryCommunity,
  } = useSWR<QuizListViewModel>(communityKey, fetchQuizListViewModel, {
    keepPreviousData: true,
  });
  const {
    data: subjectData,
    error: adaptiveError,
    isLoading: adaptiveLoading,
    mutate: retryAdaptive,
  } = useSWR(needsAdaptive ? '/api/adaptive/subjects' : null, getSubjects, {
    keepPreviousData: true,
  });

  const ownedQuizzes = ownedData?.quizzes ?? EMPTY_QUIZZES;
  const ownedIds = new Set(ownedQuizzes.map((quiz) => quiz.id));
  const rawCommunityQuizzes = communityData?.quizzes ?? EMPTY_QUIZZES;
  const communityQuizzes =
    activeType === 'all'
      ? rawCommunityQuizzes.filter((quiz) => !ownedIds.has(quiz.id))
      : rawCommunityQuizzes;

  const subjects = (subjectData ?? []).map((subject) =>
    toDashboardSubject(subject, locale, tAdaptiveDashboard),
  );
  const matchingSubjects = filterAdaptiveSubjects(subjects, query, locale);

  const adaptivePageCount = Math.ceil(matchingSubjects.length / PAGE_SIZE);
  const visibleSubjects =
    activeType === 'all'
      ? matchingSubjects.slice(0, ALL_SECTION_LIMIT)
      : matchingSubjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activePagination =
    activeType === 'mine'
      ? ownedData?.pagination
      : activeType === 'quizzes'
        ? communityData?.pagination
        : activeType === 'adaptive'
          ? {
              currentPage: page,
              totalPages: adaptivePageCount,
            }
          : null;

  const tabs = SEARCH_TYPES.map((type) => ({
    type,
    label: t(`tabs.${type}`),
  }));
  const visibilityOptions = [
    { value: 'all', label: t('visibility.all') },
    { value: 'public', label: t('visibility.public') },
    { value: 'private', label: t('visibility.private') },
  ] as const;

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1340px]">
        <div className="lg:hidden">
          <ExploreSearchInput
            key={query}
            initialQuery={query}
            placeholder={t('searchPlaceholder')}
            onCommit={(nextQuery) => updateUrl({ q: nextQuery, page: 1 })}
          />
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label={t('filterLabel')}>
          {tabs.map((tab) => (
            <button
              key={tab.type}
              type="button"
              onClick={() => updateUrl({ type: tab.type, page: 1, visibility: 'all' })}
              className={`min-h-10 shrink-0 rounded-full px-4 font-home text-sm font-semibold transition-colors ${
                activeType === tab.type
                  ? 'bg-brand-action text-white'
                  : 'border border-line bg-surface text-ink hover:bg-accent-soft'
              }`}
              aria-pressed={activeType === tab.type}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {activeType === 'all' ? (
            <>
              <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
                <SectionHeading
                  title={t('sections.mine.title')}
                  subtitle={t('sections.mine.subtitle')}
                  href={query ? `?q=${encodeURIComponent(query)}&type=mine` : '?type=mine'}
                  viewAllLabel={t('viewAll')}
                />
                {ownedLoading ? (
                  <QuizGridSkeleton />
                ) : ownedError ? (
                  <SectionError onRetry={() => void retryOwned()} />
                ) : ownedQuizzes.length > 0 ? (
                  <QuizResults quizzes={ownedQuizzes} />
                ) : (
                  <p className="font-home text-sm text-ink-muted">{t('sections.mine.empty')}</p>
                )}
              </SurfaceCard>

              <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
                <SectionHeading
                  title={t('sections.adaptive.title')}
                  subtitle={t('sections.adaptive.subtitle')}
                  href={query ? `?q=${encodeURIComponent(query)}&type=adaptive` : '?type=adaptive'}
                  viewAllLabel={t('viewAll')}
                />
                {adaptiveLoading ? (
                  <AdaptiveGridSkeleton />
                ) : adaptiveError ? (
                  <SectionError onRetry={() => void retryAdaptive()} />
                ) : visibleSubjects.length > 0 ? (
                  <AdaptiveResults
                    subjects={visibleSubjects}
                    loadingJobId={loadingJobId}
                    onOpenSubject={(jobId) => void startSubject(jobId)}
                  />
                ) : (
                  <p className="font-home text-sm text-ink-muted">{t('sections.adaptive.empty')}</p>
                )}
              </SurfaceCard>

              <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
                <SectionHeading
                  title={t('sections.quizzes.title')}
                  subtitle={t('sections.quizzes.subtitle')}
                  href={query ? `?q=${encodeURIComponent(query)}&type=quizzes` : '?type=quizzes'}
                  viewAllLabel={t('viewAll')}
                />
                {communityLoading ? (
                  <QuizGridSkeleton />
                ) : communityError ? (
                  <SectionError onRetry={() => void retryCommunity()} />
                ) : communityQuizzes.length > 0 ? (
                  <QuizResults quizzes={communityQuizzes} />
                ) : (
                  <p className="font-home text-sm text-ink-muted">{t('sections.quizzes.empty')}</p>
                )}
              </SurfaceCard>
            </>
          ) : (
            <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeading
                  title={t(`sections.${activeType}.title`)}
                  subtitle={t(`sections.${activeType}.subtitle`)}
                />
                {activeType === 'quizzes' ? (
                  <SegmentedControl
                    ariaLabel={t('visibility.label')}
                    value={activeVisibility}
                    options={visibilityOptions}
                    onChange={(visibility) => updateUrl({ visibility, page: 1 })}
                  />
                ) : null}
              </div>
              {activeType === 'mine' ? (
                ownedLoading ? (
                  <QuizGridSkeleton count={6} />
                ) : ownedError ? (
                  <SectionError onRetry={() => void retryOwned()} />
                ) : ownedQuizzes.length > 0 ? (
                  <QuizResults quizzes={ownedQuizzes} />
                ) : (
                  <EmptyState hasQuery={Boolean(query)} />
                )
              ) : activeType === 'quizzes' ? (
                communityLoading ? (
                  <QuizGridSkeleton count={6} />
                ) : communityError ? (
                  <SectionError onRetry={() => void retryCommunity()} />
                ) : communityQuizzes.length > 0 ? (
                  <QuizResults quizzes={communityQuizzes} />
                ) : (
                  <EmptyState hasQuery={Boolean(query)} />
                )
              ) : adaptiveLoading ? (
                <AdaptiveGridSkeleton count={6} />
              ) : adaptiveError ? (
                <SectionError onRetry={() => void retryAdaptive()} />
              ) : visibleSubjects.length > 0 ? (
                <AdaptiveResults
                  subjects={visibleSubjects}
                  loadingJobId={loadingJobId}
                  onOpenSubject={(jobId) => void startSubject(jobId)}
                />
              ) : (
                <EmptyState hasQuery={Boolean(query)} />
              )}
            </SurfaceCard>
          )}

          {activeType !== 'all' && activePagination && activePagination.totalPages > 1 ? (
            <div className="flex justify-center pt-2">
              <Pagination
                currentPage={activePagination.currentPage}
                totalPages={activePagination.totalPages}
                onPageChange={(nextPage) => updateUrl({ page: nextPage })}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ExploreFallback() {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1340px] space-y-6">
        <div className="h-8 w-56 rounded-md skeleton-shimmer" />
        <div className="h-12 max-w-3xl rounded-xl skeleton-shimmer" />
        <QuizGridSkeleton count={6} />
      </div>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <ExploreContent />
    </Suspense>
  );
}
