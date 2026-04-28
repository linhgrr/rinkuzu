'use client';

import { memo } from 'react';
import Image from 'next/image';
import {
  HiOutlineBookOpen,
  HiOutlineClock,
  HiOutlineCloudUpload,
  HiOutlineLightningBolt,
  HiOutlinePlay,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineViewGrid,
  HiOutlineViewList,
} from '@/components/icons';
import { SparklesText } from '@/components/ui/sparkles-text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useRandomLibraryImages } from './hooks/use-random-library-images';
import type { DashboardSubject } from './dashboard-view-model';
import type { PipelineJobHistoryItem } from './types';

type TranslateFn = (key: string, values?: Record<string, any>) => string;

type DashboardHeaderProps = {
  apiOnline: boolean | null;
  dailyGoalProgress: { current: number; total: number; percent: number };
  error: string | null;
  streakDays: number;
  t: TranslateFn;
};

type HeroProps = {
  subject: DashboardSubject | null;
  loading: boolean;
  loadingJobId: string | null;
  onGoUpload: () => void;
  onOpenSubject: (jobId: string) => void;
  t: TranslateFn;
};

type DailyProgressCardProps = {
  dailyGoalProgress: { current: number; total: number; percent: number };
  t: TranslateFn;
};

type LibraryProps = {
  subjects: DashboardSubject[];
  loading: boolean;
  loadingJobId: string | null;
  deletingJobId: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onGoUpload: () => void;
  onOpenSubject: (jobId: string) => void;
  onDelete: (job: PipelineJobHistoryItem) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  t: TranslateFn;
};

type SubjectLibraryCardProps = {
  subject: DashboardSubject;
  loading: boolean;
  deleting: boolean;
  imageUrl?: string;
  onOpenSubject: (jobId: string) => void;
  onDelete: (job: PipelineJobHistoryItem) => void;
  t: TranslateFn;
};

type DashboardDeleteModalProps = {
  cancelText: string;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: TranslateFn;
};

type FloatingUploadActionProps = {
  onClick: () => void;
  t: TranslateFn;
};

const DashboardStatusPill = ({ tone, text }: { tone: 'error' | 'warning'; text: string }) => (
  <div
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
      tone === 'error'
        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
        : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    }`}
  >
    <span className={`h-2 w-2 rounded-full ${tone === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
    {text}
  </div>
);

export const DashboardHeader = ({
  apiOnline,
  dailyGoalProgress,
  error,
  streakDays,
  t,
}: DashboardHeaderProps) => (
  <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
    <div>
      <SparklesText
        text={t('brandTitle')}
        sparklesCount={9}
        colors={{ first: '#8B5CF6', second: '#F472B6' }}
        className="text-4xl font-extrabold tracking-tight text-[#3b2ca5] md:text-5xl"
      />
      <p className="mt-2 text-lg font-medium text-neutral-600">{t('brandSubtitle')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {apiOnline === false && (
          <DashboardStatusPill tone="warning" text={t('connectionLimited')} />
        )}
        {error && <DashboardStatusPill tone="error" text={error} />}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#f8c56a] to-[#f39a2f] shadow-md">
          <HiOutlineLightningBolt className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-neutral-900">
          {t('dayStreak', { count: streakDays })}
        </span>
      </div>
      <div className="flex min-w-[9.5rem] items-center gap-3 rounded-full border border-neutral-300/60 bg-white px-4 py-2.5 shadow-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#45d2be] to-[#1cb0a2] shadow-md">
          <HiOutlineClock className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-600">
            {t('dailyGoalProgress', {
              current: dailyGoalProgress.current,
              total: dailyGoalProgress.total,
            })}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-trust"
              style={{ width: `${dailyGoalProgress.percent}%` }}
            />
          </div>
        </div>
      </div>
      {/* <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-brand-trust-hover bg-green-50">
        <Image src="/images/mascot_image.png" alt={t('avatarAlt')} width={48} height={48} className="h-full w-full object-contain" />
      </div> */}
    </div>
  </div>
);

export const HeroSection = ({
  subject,
  loading,
  loadingJobId,
  onGoUpload,
  onOpenSubject,
  t,
}: HeroProps) => {
  if (loading && !subject)
    return (
      <section className="h-[23rem] animate-pulse rounded-2xl border border-neutral-300/60 bg-white/60 lg:col-span-8" />
    );

  if (!subject) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
        <div className="relative z-10 flex h-full flex-col justify-between gap-10 lg:max-w-[58%]">
          <div>
            <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
              {t('activeJourney')}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight text-neutral-900 md:text-5xl">
              {t('uploadMaterialTitle')}
            </h1>
            <p className="mt-3 max-w-xl text-lg font-medium text-neutral-600">
              {t('uploadMaterialHint')}
            </p>
          </div>
          <Button
            onClick={onGoUpload}
            className="rounded-full bg-brand-action px-10 py-4 text-white shadow-lg shadow-[var(--shadow-orange-glow)] hover:bg-brand-action-hover"
          >
            <HiOutlineCloudUpload className="h-5 w-5" />
            {t('uploadDocument')}
          </Button>
        </div>
        <div className="pointer-events-none absolute -bottom-2 right-0 hidden w-[20rem] translate-x-5 lg:block">
          <Image
            src="/images/green_boy.png"
            alt={t('avatarAlt')}
            width={420}
            height={500}
            className="h-auto w-full object-contain opacity-80"
            priority={false}
          />
        </div>
        <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl" />
      </section>
    );
  }

  const isOpening = loadingJobId === subject.job_id;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
      <div className="relative z-10 flex h-full flex-col justify-between gap-10 lg:max-w-[54%]">
        <div>
          <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
            {t('activeJourney')}
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-neutral-900 md:text-5xl">
            {subject.displayTitle}
          </h1>
          <p className="mt-3 max-w-xl text-lg font-medium text-neutral-600">
            {t('pickUpDescription')}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-4">
            <span className="text-lg font-bold text-brand-trust">
              {t('completePercent', { percent: subject.metrics.progressPercent })}
            </span>
            <span className="text-sm font-medium text-neutral-600">
              {subject.metrics.allConcepts > 0
                ? t('conceptsToGo', { count: subject.metrics.remainingConcepts })
                : t('progressPending')}
            </span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-trust to-green-400 shadow-[var(--shadow-green-glow)]"
              style={{ width: `${subject.metrics.progressPercent}%` }}
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button
              onClick={() => onOpenSubject(subject.job_id)}
              disabled={isOpening}
              className="rounded-full bg-brand-action px-10 py-4 text-white shadow-lg shadow-[var(--shadow-orange-glow)] hover:bg-brand-action-hover"
            >
              <HiOutlinePlay className="h-5 w-5" />
              {isOpening ? t('creatingSession') : t('continueLearning')}
            </Button>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-4 right-0 hidden w-[25rem] translate-x-6 lg:block">
        <Image
          src="/images/green_boy.png"
          alt={t('avatarAlt')}
          width={520}
          height={640}
          className="h-auto w-full object-contain drop-shadow-[0_14px_28px_rgba(31,45,61,0.18)]"
          priority
        />
      </div>
      <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl transition-colors duration-700" />
    </section>
  );
};

export const DailyProgressCard = ({ dailyGoalProgress, t }: DailyProgressCardProps) => (
  <section className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm lg:col-span-4">
    <div>
      <h2 className="mb-8 text-2xl font-extrabold tracking-tight text-neutral-900">
        {t('dailyProgressTitle')}
      </h2>
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8ff2df] to-[#57d9c9] shadow-[0_10px_20px_rgba(44,192,170,0.25)]">
            <HiOutlineLightningBolt className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
              {t('earnedToday')}
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">1,250 XP</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffcf77] to-[#f6a636] shadow-[0_10px_20px_rgba(246,166,54,0.24)]">
            <HiOutlineBookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
              {t('achievements')}
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">4 {t('unlocked')}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-8 border-t border-neutral-300/60 pt-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-neutral-900">{t('levelArchitect')}</span>
        <span className="text-xs font-medium text-neutral-600">
          {t('dailyGoalProgress', {
            current: dailyGoalProgress.current,
            total: dailyGoalProgress.total,
          })}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-brand-trust shadow-[var(--shadow-green-glow)]"
          style={{ width: `${Math.max(dailyGoalProgress.percent, 8)}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-600">{t('levelProgressHint')}</p>
    </div>
  </section>
);

const UploadCard = ({ onGoUpload, t }: { onGoUpload: () => void; t: TranslateFn }) => (
  <div className="group flex min-h-[21rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 p-8 text-center transition-colors duration-300 hover:border-brand-trust/50 hover:bg-brand-trust/5">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 transition-transform duration-300 group-hover:scale-110">
      <HiOutlineCloudUpload className="h-10 w-10 text-brand-action" />
    </div>
    <h3 className="mb-2 text-xl font-bold text-neutral-900">{t('uploadNewPdf')}</h3>
    <p className="mb-6 text-sm text-neutral-600">{t('uploadDragDropHint')}</p>
    <Button
      onClick={onGoUpload}
      className="rounded-full bg-brand-action px-8 py-2.5 font-bold text-white shadow-md hover:bg-brand-action-hover"
    >
      {t('chooseFile')}
    </Button>
  </div>
);

const SubjectLibraryCard = memo(function SubjectLibraryCard({
  subject,
  loading,
  deleting,
  onOpenSubject,
  onDelete,
  imageUrl,
  t,
}: SubjectLibraryCardProps) {
  const progressBarClass = 'bg-brand-trust';

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <div className="mb-4">
        <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          {imageUrl ? (
            // The image source is discovered at runtime from an external API.
            // Keep a plain img here until the remote host set is stabilized in next.config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={subject.displayTitle}
              className="h-full w-full object-cover opacity-70"
              loading="lazy"
            />
          ) : (
            <HiOutlineBookOpen className="h-12 w-12 text-neutral-300" />
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="truncate text-lg font-bold text-neutral-900"
              title={subject.displayTitle}
            >
              {subject.displayTitle}
            </h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-600">
              {subject.lastOpenedLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(subject)}
            disabled={loading || deleting}
            className="text-neutral-500 hover:bg-red-50 hover:text-red-500"
            aria-label={t('deleteMaterial')}
            title={t('deleteMaterial')}
          >
            <HiOutlineTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-brand-trust">
          <span>{subject.metrics.progressPercent}%</span>
          <span>{subject.progressLabel}</span>
        </div>
        <div className="mb-6 h-1.5 w-full rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${progressBarClass}`}
            style={{ width: `${subject.metrics.progressPercent}%` }}
          />
        </div>
        <Button
          onClick={() => onOpenSubject(subject.job_id)}
          disabled={loading}
          className="w-full rounded-full bg-neutral-100 py-3 text-sm font-bold text-brand-trust hover:bg-brand-trust hover:text-white"
        >
          {loading ? t('creatingSession') : subject.ctaLabel}
        </Button>
      </div>
    </div>
  );
});

const SubjectLibraryListItem = memo(function SubjectLibraryListItem({
  subject,
  loading,
  deleting,
  onOpenSubject,
  onDelete,
  imageUrl,
  t,
}: SubjectLibraryCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
          {imageUrl ? (
            // The image source is discovered at runtime from an external API.
            // Keep a plain img here until the remote host set is stabilized in next.config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={subject.displayTitle}
              className="h-full w-full object-cover opacity-75"
              loading="lazy"
            />
          ) : (
            <HiOutlineBookOpen className="h-8 w-8 text-neutral-300" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-neutral-900" title={subject.displayTitle}>
            {subject.displayTitle}
          </h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-600">
            {subject.lastOpenedLabel}
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-trust">{subject.progressLabel}</p>
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-trust"
              style={{ width: `${subject.metrics.progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 sm:justify-start">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(subject)}
          disabled={loading || deleting}
          className="text-neutral-500 hover:bg-red-50 hover:text-red-500"
          aria-label={t('deleteMaterial')}
          title={t('deleteMaterial')}
        >
          <HiOutlineTrash className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onOpenSubject(subject.job_id)}
          disabled={loading}
          className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-brand-trust hover:bg-brand-trust hover:text-white"
        >
          {loading ? t('creatingSession') : subject.ctaLabel}
        </Button>
      </div>
    </div>
  );
});

export const LibrarySection = ({
  subjects,
  loading,
  loadingJobId,
  deletingJobId,
  searchQuery,
  setSearchQuery,
  onGoUpload,
  onOpenSubject,
  onDelete,
  viewMode,
  onViewModeChange,
  t,
}: LibraryProps) => {
  const libraryImages = useRandomLibraryImages(subjects.length);

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-bold tracking-tight text-neutral-900`}>
            {t('knowledgeLibrary')}
          </h2>
          <p className="text-base text-neutral-600">{t('knowledgeLibrarySubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-[10.5rem] rounded-full border-neutral-300/70 bg-white pl-10 pr-4 sm:w-auto"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`rounded-full ${
              viewMode === 'grid'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
            aria-label={t('gridView')}
            aria-pressed={viewMode === 'grid'}
            onClick={() => onViewModeChange('grid')}
          >
            <HiOutlineViewGrid className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`rounded-full ${
              viewMode === 'list'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
            aria-label={t('listView')}
            aria-pressed={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
          >
            <HiOutlineViewList className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid grid-cols-1 gap-4'
        }
      >
        <UploadCard onGoUpload={onGoUpload} t={t} />
        {loading && subjects.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`library-skeleton-${index}`}
                className="min-h-[21rem] animate-pulse rounded-2xl border border-neutral-200 bg-white/60"
              />
            ))
          : subjects.map((subject, index) => {
              const sharedProps = {
                key: subject.job_id,
                subject,
                imageUrl:
                  libraryImages.length > 0
                    ? libraryImages[index % libraryImages.length]
                    : undefined,
                loading: loadingJobId === subject.job_id,
                deleting: deletingJobId === subject.job_id,
                onOpenSubject,
                onDelete,
                t,
              };

              return viewMode === 'grid' ? (
                <SubjectLibraryCard {...sharedProps} />
              ) : (
                <SubjectLibraryListItem {...sharedProps} />
              );
            })}
      </div>
    </section>
  );
};

export const FloatingUploadAction = ({ onClick, t }: FloatingUploadActionProps) => (
  <Button
    type="button"
    onClick={onClick}
    className="group fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-action text-white shadow-2xl transition-[width,border-radius,transform] active:scale-90 sm:h-16 sm:w-16 md:bottom-10 md:right-8 md:h-20 md:w-20 md:hover:w-48 md:hover:rounded-[2rem]"
    aria-label={t('newLesson')}
    title={t('newLesson')}
  >
    <div className="flex items-center gap-2">
      <HiOutlineCloudUpload className="h-8 w-8" />
      <span className="hidden whitespace-nowrap font-bold md:group-hover:block">
        {t('newLesson')}
      </span>
    </div>
  </Button>
);

export const DashboardDeleteModal = ({
  cancelText,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
  t,
}: DashboardDeleteModalProps) => (
  <ConfirmModal
    isOpen={isOpen}
    title={t('deleteDocumentTitle')}
    message={<span className="text-sm text-neutral-500">{t('deleteConfirmDescription')}</span>}
    confirmText={t('deleteMaterial')}
    cancelText={cancelText}
    confirmVariant="destructive"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
  />
);
