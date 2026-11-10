'use client';

import { Fragment, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LibraryCardSkeleton, SubjectCard } from '@/features/adaptive/components/sections/Library';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import type { QuizListItemViewModel } from '@/features/quiz/types/quiz-list-view-model';

/** Cards per section on the All tab before "View all". */
export const ALL_SECTION_LIMIT = 4;
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
export const QUIZ_ROW_MIN_HEIGHT = 'min-h-36';
export const ADAPTIVE_ROW_MIN_HEIGHT = 'min-h-48 sm:min-h-52';

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

export function QuizGridSkeleton(props: GridSkeletonProps) {
  return <GridSkeleton {...props} keyPrefix="quiz-search-skeleton" card={<QuizCardSkeleton />} />;
}

export function AdaptiveGridSkeleton(props: GridSkeletonProps) {
  return (
    <GridSkeleton {...props} keyPrefix="adaptive-search-skeleton" card={<LibraryCardSkeleton />} />
  );
}

/** All-tab empty line, as tall as the card row it replaces. */
export function SectionEmpty({ message, minHeight }: { message: string; minHeight: string }) {
  return (
    <p
      className={`flex items-center justify-center rounded-xl border border-dashed border-line px-4 text-center font-home text-sm text-ink-muted ${minHeight}`}
    >
      {message}
    </p>
  );
}

export function QuizResults({
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

export function AdaptiveResults({
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
