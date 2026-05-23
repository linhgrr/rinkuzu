'use client';

import Image from 'next/image';
import { memo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  HiOutlineBookOpen,
  HiOutlineCloudUpload,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineViewGrid,
  HiOutlineViewList,
} from '@/components/icons';
import { useRandomLibraryImages } from '@/features/adaptive/hooks/use-random-library-images';
import type { DashboardSubject } from '@/features/adaptive/lib/dashboard-view-model';
import type { PipelineJobHistoryItem, TranslateFn } from '@/features/adaptive/types';
import { SubjectLibraryCard } from './SubjectLibraryCard';

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

const UploadCard = ({ onGoUpload, t }: { onGoUpload: () => void; t: TranslateFn }) => (
  <div className="group flex min-h-[21rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 p-8 text-center transition-colors duration-300 hover:border-brand-trust/50 hover:bg-brand-trust/5">
    <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-green-500/10 transition-transform duration-300 group-hover:scale-110">
      <HiOutlineCloudUpload className="size-10 text-brand-action" />
    </div>
    <h3 className="mb-2 text-xl font-semibold text-neutral-900">{t('uploadNewPdf')}</h3>
    <p className="mb-6 text-sm text-neutral-600">{t('uploadDragDropHint')}</p>
    <Button
      onClick={onGoUpload}
      className="rounded-full bg-brand-action px-8 font-bold text-white shadow-md hover:bg-brand-action-hover"
    >
      {t('chooseFile')}
    </Button>
  </div>
);

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
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={subject.displayTitle}
              width={80}
              height={80}
              className="h-full w-full object-cover opacity-75"
              sizes="80px"
            />
          ) : (
            <HiOutlineBookOpen className="size-8 text-neutral-300" />
          )}
        </div>
        <div className="min-w-0">
          <h3
            className="truncate text-lg font-semibold text-neutral-900"
            title={subject.displayTitle}
          >
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
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
          aria-label={t('deleteMaterial')}
          title={t('deleteMaterial')}
        >
          <HiOutlineTrash className="size-4" />
        </Button>
        <Button
          onClick={() => onOpenSubject(subject.job_id)}
          disabled={loading}
          className="rounded-full bg-neutral-100 px-5 text-sm font-bold text-brand-trust hover:bg-brand-trust hover:text-white"
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
          <h2 className={`text-3xl font-semibold tracking-tight text-neutral-900`}>
            {t('knowledgeLibrary')}
          </h2>
          <p className="text-base text-neutral-600">{t('knowledgeLibrarySubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
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
            <HiOutlineViewGrid className="size-5" />
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
            <HiOutlineViewList className="size-5" />
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
                <SubjectLibraryCard key={subject.job_id} {...sharedProps} />
              ) : (
                <SubjectLibraryListItem key={subject.job_id} {...sharedProps} />
              );
            })}
      </div>
    </section>
  );
};
