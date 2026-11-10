'use client';

import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { Fragment, Suspense, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { HiOutlineSearch } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { LibraryCardSkeleton, SubjectCard } from '@/features/adaptive/components/sections/Library';
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
  parseSearchPage,
  parseSearchType,
  type SearchType,
} from '@/features/explore/lib/search';
import { ROUTES } from '@/shared/constants/routes';

const SEARCH_TYPES: SearchType[] = ['all', 'mine', 'adaptive', 'quizzes'];
const ALL_SECTION_LIMIT = 4;
const PAGE_SIZE = 12;
const EMPTY_QUIZZES: QuizListItemViewModel[] = [];
const GRID_CLASS = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';

/**
 * On the All tab, Your quizzes and Adaptive preview exactly one grid row: 1 card under md,
 * 2 from md, 3 from xl ("View all" opens the rest). Their loading, empty and filled states
 * then share one height, so the panels below no longer jump when the fetch settles
 * (RIN-1406: CLS 0.377 on mobile when 4 stacked skeletons collapsed to one empty line).
 */
const ROW_SLOT_CLASSES = ['grid', 'hidden md:grid', 'hidden xl:grid'] as const;
const ROW_LIMIT = ROW_SLOT_CLASSES.length;
/**
 * Heights of one card row on the spacing scale, within 4px of the cards they stand in for:
 * QuizCard(Skeleton) is 146px, the Library card 196px (212px from sm).
 */
const QUIZ_ROW_MIN_HEIGHT = 'min-h-36';
const ADAPTIVE_ROW_MIN_HEIGHT = 'min-h-48 sm:min-h-52';

/** Grid cell that shows its card only at widths where it fits in the first row. */
function RowSlot({ index, children }: { index: number; children: ReactNode }) {
  return <div className={ROW_SLOT_CLASSES[index]}>{children}</div>;
}

/** Stable keys for a fixed run of placeholder cards. */
function skeletonKeys(prefix: string, count: number) {
  return Array.from({ length: count }, (_, position) => `${prefix}-${position}`);
}

interface GridSkeletonProps {
  count?: number;
  /** All-tab preview: one row of skeletons, the same height as what replaces it. */
  oneRow?: boolean;
}

function GridSkeleton({
  count = ALL_SECTION_LIMIT,
  oneRow = false,
  keyPrefix,
  card,
}: GridSkeletonProps & { keyPrefix: string; card: ReactNode }) {
  return (
    <div className={GRID_CLASS}>
      {oneRow
        ? ROW_SLOT_CLASSES.map((slotClass) => (
            <div key={slotClass} className={slotClass}>
              {card}
            </div>
          ))
        : skeletonKeys(keyPrefix, count).map((key) => <Fragment key={key}>{card}</Fragment>)}
    </div>
  );
}

function QuizGridSkeleton(props: GridSkeletonProps) {
  return <GridSkeleton {...props} keyPrefix="quiz-search-skeleton" card={<QuizCardSkeleton />} />;
}

function AdaptiveGridSkeleton(props: GridSkeletonProps) {
  return (
    <GridSkeleton {...props} keyPrefix="adaptive-search-skeleton" card={<LibraryCardSkeleton />} />
  );
}

/** All-tab empty line, as tall as the card row it replaces. */
function SectionEmpty({ message, minHeight }: { message: string; minHeight: string }) {
  return (
    <p
      className={`flex items-center justify-center rounded-xl border border-dashed border-line px-4 text-center font-home text-sm text-ink-muted ${minHeight}`}
    >
      {message}
    </p>
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

function SignedOutPrompt({ message, callbackPath }: { message: string; callbackPath: string }) {
  const t = useTranslations('explore');

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-home text-sm text-ink-muted">{message}</p>
      <Link
        href={`${ROUTES.LOGIN}?callbackUrl=${encodeURIComponent(callbackPath)}`}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-brand-action-strong px-4 font-home text-sm font-semibold text-white transition-colors hover:bg-brand-action-strong-hover focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:bg-brand-action-strong-hover"
      >
        {t('signInCta')}
      </Link>
    </div>
  );
}

function QuizResults({
  quizzes,
  oneRow = false,
}: {
  quizzes: QuizListItemViewModel[];
  oneRow?: boolean;
}) {
  return (
    <div className={GRID_CLASS}>
      {oneRow
        ? quizzes.slice(0, ROW_LIMIT).map((quiz, index) => (
            <RowSlot key={quiz.id} index={index}>
              <QuizCard quiz={quiz} quizId={quiz.id} />
            </RowSlot>
          ))
        : quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} quizId={quiz.id} />)}
    </div>
  );
}

function AdaptiveResults({
  subjects,
  loadingJobId,
  onOpenSubject,
  oneRow = false,
}: {
  subjects: DashboardSubject[];
  loadingJobId: string | null;
  onOpenSubject: (jobId: string) => void;
  oneRow?: boolean;
}) {
  const t = useTranslations('adaptiveLearning.dashboard');
  const card = (subject: DashboardSubject) => (
    <SubjectCard
      subject={subject}
      loading={loadingJobId === subject.jobId}
      deleting={false}
      busy={loadingJobId !== null}
      onOpenSubject={onOpenSubject}
      t={t}
    />
  );

  return (
    <div className={GRID_CLASS}>
      {oneRow
        ? subjects.slice(0, ROW_LIMIT).map((subject, index) => (
            <RowSlot key={subject.jobId} index={index}>
              {card(subject)}
            </RowSlot>
          ))
        : subjects.map((subject) => <Fragment key={subject.jobId}>{card(subject)}</Fragment>)}
    </div>
  );
}

interface ExplorePageClientProps {
  /** Server-rendered topic hub links (RIN-1249 B6), shown under the h1; null hides them. */
  hubLinks?: ReactNode;
}

function ExploreContent({ hubLinks }: ExplorePageClientProps) {
  const t = useTranslations('explore');
  const tAdaptive = useTranslations('adaptiveLearning');
  const tAdaptiveDashboard = useTranslations('adaptiveLearning.dashboard');
  const locale = useLocale();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const activeType = parseSearchType(searchParams.get('type'));
  const page = parseSearchPage(searchParams.get('page'));
  // "Mine" and adaptive subjects are per-user: never request them signed out (RIN-680).
  const { status: sessionStatus } = useSession();
  const isSignedIn = sessionStatus === 'authenticated';
  const sessionPending = sessionStatus === 'loading';
  const isSignedOut = sessionStatus === 'unauthenticated';
  const currentSearch = searchParams.toString();
  const callbackPath = currentSearch ? `${ROUTES.EXPLORE}?${currentSearch}` : ROUTES.EXPLORE;
  const { loadingJobId, startSubject } = useStartAdaptiveSubject({
    t: tAdaptiveDashboard,
    tAdaptive,
  });

  const updateUrl = (next: { q?: string; type?: SearchType; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = next.q ?? query;
    const nextType = next.type ?? activeType;
    const nextPage = next.page ?? page;

    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    else params.delete('q');
    if (nextType === 'all') params.delete('type');
    else params.set('type', nextType);
    if (nextPage > 1) params.set('page', String(nextPage));
    else params.delete('page');
    params.delete('visibility');

    const queryString = params.toString();
    replace(queryString ? `?${queryString}` : '?', { scroll: false });
  };

  const quizLimit = activeType === 'all' ? ALL_SECTION_LIMIT : PAGE_SIZE;
  const quizPage = activeType === 'all' ? 1 : page;
  const needsOwned = isSignedIn && (activeType === 'all' || activeType === 'mine');
  const needsCommunity = activeType === 'all' || activeType === 'quizzes';
  const needsAdaptive = isSignedIn && (activeType === 'all' || activeType === 'adaptive');

  const ownedKey = needsOwned
    ? buildQuizSearchKey({ query, page: quizPage, mine: true, limit: quizLimit })
    : null;
  const communityKey = needsCommunity
    ? buildQuizSearchKey({
        query,
        page: quizPage,
        mine: false,
        limit: quizLimit,
      })
    : null;

  const {
    data: ownedData,
    error: ownedError,
    isLoading: ownedFetching,
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
    isLoading: adaptiveFetching,
    mutate: retryAdaptive,
  } = useSWR(needsAdaptive ? '/api/adaptive/subjects' : null, getSubjects, {
    keepPreviousData: true,
  });

  const ownedLoading = sessionPending || ownedFetching;
  const adaptiveLoading = sessionPending || adaptiveFetching;
  const ownedSignedOut = (
    <SignedOutPrompt message={t('sections.mine.signedOut')} callbackPath={callbackPath} />
  );
  const adaptiveSignedOut = (
    <SignedOutPrompt message={t('sections.adaptive.signedOut')} callbackPath={callbackPath} />
  );

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
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1340px]">
        <h1 className="font-home text-2xl font-semibold text-ink sm:text-3xl">{t('pageTitle')}</h1>
        {hubLinks}

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
              onClick={() => updateUrl({ type: tab.type, page: 1 })}
              className={`min-h-10 shrink-0 rounded-full px-4 font-home text-sm font-semibold transition-colors ${
                activeType === tab.type
                  ? 'bg-brand-action-strong text-white'
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
                {isSignedOut ? (
                  ownedSignedOut
                ) : ownedLoading ? (
                  <QuizGridSkeleton oneRow />
                ) : ownedError ? (
                  <SectionError onRetry={() => void retryOwned()} />
                ) : ownedQuizzes.length > 0 ? (
                  <QuizResults quizzes={ownedQuizzes} oneRow />
                ) : (
                  <SectionEmpty
                    message={t('sections.mine.empty')}
                    minHeight={QUIZ_ROW_MIN_HEIGHT}
                  />
                )}
              </SurfaceCard>

              <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
                <SectionHeading
                  title={t('sections.adaptive.title')}
                  subtitle={t('sections.adaptive.subtitle')}
                  href={query ? `?q=${encodeURIComponent(query)}&type=adaptive` : '?type=adaptive'}
                  viewAllLabel={t('viewAll')}
                />
                {isSignedOut ? (
                  adaptiveSignedOut
                ) : adaptiveLoading ? (
                  <AdaptiveGridSkeleton oneRow />
                ) : adaptiveError ? (
                  <SectionError onRetry={() => void retryAdaptive()} />
                ) : visibleSubjects.length > 0 ? (
                  <AdaptiveResults
                    subjects={visibleSubjects}
                    loadingJobId={loadingJobId}
                    onOpenSubject={(jobId) => void startSubject(jobId)}
                    oneRow
                  />
                ) : (
                  <SectionEmpty
                    message={t('sections.adaptive.empty')}
                    minHeight={ADAPTIVE_ROW_MIN_HEIGHT}
                  />
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
              <SectionHeading
                title={t(`sections.${activeType}.title`)}
                subtitle={t(`sections.${activeType}.subtitle`)}
              />
              {activeType === 'mine' ? (
                isSignedOut ? (
                  ownedSignedOut
                ) : ownedLoading ? (
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
              ) : isSignedOut ? (
                adaptiveSignedOut
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

function ExploreFallback({ hubLinks }: ExplorePageClientProps) {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1340px] space-y-6">
        <div className="h-9 w-56 rounded-md skeleton-shimmer" />
        {hubLinks}
        <div className="h-12 max-w-3xl rounded-xl skeleton-shimmer" />
        <QuizGridSkeleton count={6} />
      </div>
    </main>
  );
}

export function ExplorePageClient({ hubLinks = null }: ExplorePageClientProps = {}) {
  return (
    <Suspense fallback={<ExploreFallback hubLinks={hubLinks} />}>
      <ExploreContent hubLinks={hubLinks} />
    </Suspense>
  );
}
