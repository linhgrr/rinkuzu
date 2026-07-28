'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DashboardDeleteModal } from './sections/DashboardDeleteModal';
import { HeroSection } from './sections/HeroSection';
import { LibrarySection } from './sections/Library';
import { RecentActivity, UploadMaterialCard } from './sections/OverviewSidebar';
import { useAdaptiveDashboard } from '@/features/adaptive/hooks/use-adaptive-dashboard';
import type { SessionHistoryItem } from '@/features/adaptive/types/history';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';

interface DashboardProps {
  initialSubjects: PipelineJobHistoryItem[];
  initialSessionHistory: SessionHistoryItem[];
  initialApiOnline?: boolean | null;
  initialErrorKey?: 'connectionLimited' | null;
  didHydrateFromServer?: boolean;
}

export default function AdaptiveLearningDashboard({
  initialSubjects,
  initialSessionHistory,
  initialApiOnline = true,
  initialErrorKey = null,
  didHydrateFromServer = false,
}: DashboardProps) {
  const tAdaptive = useTranslations('adaptiveLearning');
  const tDashboard = useTranslations('adaptiveLearning.dashboard');
  const searchParams = useSearchParams();
  const locale = tAdaptive('common.locale_date');
  const {
    apiOnline,
    busyJobId,
    cancel,
    deletingJobId,
    error,
    filteredSubjects,
    handleCancelDelete,
    handleConfirmDelete,
    handleDeleteClick,
    handleGoUpload,
    handleOpenSubject,
    itemToDelete,
    libraryLoading,
    loading,
    loadingJobId,
    retry,
    sessionHistory,
    setSearchQuery,
    upNextSubject,
  } = useAdaptiveDashboard({
    initialSubjects,
    initialSessionHistory,
    initialApiOnline,
    initialError: initialErrorKey ? tDashboard(initialErrorKey) : null,
    didHydrateFromServer,
    locale,
    t: tDashboard,
    tAdaptive,
  });

  const dashboardSubjects = filteredSubjects;

  useEffect(() => {
    setSearchQuery(searchParams.get('search') ?? '');
  }, [searchParams, setSearchQuery]);

  return (
    <div className="pb-16 font-home text-ink selection:bg-accent-soft sm:pb-20">
      <div className="mb-5 flex flex-col gap-1 sm:mb-6">
        <h1 className="font-home text-body-2xl font-semibold sm:text-2xl sm:leading-[1.4]">
          {tDashboard('pageTitle')}
        </h1>
        <p className="max-w-[65ch] font-home text-sm leading-[1.5] sm:text-body">
          {tDashboard('pageSubtitle')}
        </p>
        {apiOnline === false || error ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
            {error ?? tDashboard('connectionLimited')}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 min-[1684px]:grid-cols-[minmax(0,900px)_416px] min-[1684px]:gap-6">
        <div className="min-w-0 md:col-span-2 min-[1684px]:col-span-1 min-[1684px]:col-start-1 min-[1684px]:row-start-1">
          <HeroSection
            subject={upNextSubject ?? null}
            loading={loading}
            loadingJobId={loadingJobId}
            onGoUpload={handleGoUpload}
            onOpenSubject={handleOpenSubject}
            onCancel={cancel}
            busyJobId={busyJobId}
            t={tDashboard}
          />
        </div>

        <div className="min-w-0 md:col-start-1 md:row-start-2 min-[1684px]:col-start-2 min-[1684px]:row-start-1">
          <UploadMaterialCard onGoUpload={handleGoUpload} t={tDashboard} />
        </div>

        <div className="min-w-0 md:col-span-2 md:row-start-3 min-[1684px]:col-span-1 min-[1684px]:col-start-1 min-[1684px]:row-start-2">
          <LibrarySection
            subjects={dashboardSubjects}
            loading={libraryLoading}
            loadingJobId={loadingJobId}
            deletingJobId={deletingJobId}
            onOpenSubject={handleOpenSubject}
            onDelete={handleDeleteClick}
            onRetry={retry}
            onCancel={cancel}
            busyJobId={busyJobId}
            t={tDashboard}
          />
        </div>

        <div className="min-w-0 md:col-start-2 md:row-start-2 min-[1684px]:col-start-2">
          <RecentActivity sessions={sessionHistory} t={tDashboard} />
        </div>
      </div>

      <DashboardDeleteModal
        cancelText={tAdaptive('common.cancel')}
        isOpen={!!itemToDelete}
        isLoading={!!deletingJobId}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        t={tDashboard}
      />
    </div>
  );
}
