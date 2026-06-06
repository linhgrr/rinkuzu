'use client';

import { useMemo, useState } from 'react';
import { Inter } from 'next/font/google';
import { useTranslations } from 'next-intl';
import {
  DashboardDeleteModal,
  DashboardHeader,
  DailyProgressCard,
  FloatingUploadAction,
  HeroSection,
  LibrarySection,
} from './DashboardSections';
import { useAdaptiveDashboard } from '@/features/adaptive/hooks/use-adaptive-dashboard';
import { toDashboardSubject } from '@/features/adaptive/lib/dashboard-view-model';
import type { PipelineJobHistoryItem, SessionHistoryItem } from '@/features/adaptive/types';

const inter = Inter({ subsets: ['latin'] });

interface DashboardProps {
  initialSubjects: PipelineJobHistoryItem[];
  initialSessionHistory: SessionHistoryItem[];
  didHydrateFromServer?: boolean;
}

export default function AdaptiveLearningDashboard({
  initialSubjects,
  initialSessionHistory,
  didHydrateFromServer = false,
}: DashboardProps) {
  const tAdaptive = useTranslations('adaptiveLearning');
  const tDashboard = useTranslations('adaptiveLearning.dashboard');
  const locale = tAdaptive('common.locale_date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const {
    apiOnline,
    busyJobId,
    cancel,
    dailyGoalProgress,
    deletingJobId,
    error,
    filteredSubjects,
    handleCancelDelete,
    handleConfirmDelete,
    handleDeleteClick,
    handleGoUpload,
    handleOpenSubject,
    itemToDelete,
    loading,
    loadingJobId,
    retry,
    searchQuery,
    setSearchQuery,
    streakDays,
    upNextSubject,
  } = useAdaptiveDashboard({
    initialSubjects,
    initialSessionHistory,
    didHydrateFromServer,
    locale,
    t: tDashboard,
    tAdaptive,
  });

  const dashboardSubjects = filteredSubjects;

  const upNextDashboardSubject = useMemo(
    () => (upNextSubject ? toDashboardSubject(upNextSubject, locale, tDashboard) : null),
    [locale, tDashboard, upNextSubject],
  );

  return (
    <div className={`${inter.className} min-h-screen bg-neutral-50 text-neutral-900`}>
      <main className="mx-auto w-full max-w-7xl p-8 md:p-12">
        <DashboardHeader
          apiOnline={apiOnline}
          dailyGoalProgress={dailyGoalProgress}
          error={error}
          streakDays={streakDays}
          t={tDashboard}
        />

        <section className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <HeroSection
            subject={upNextDashboardSubject}
            loading={loading}
            loadingJobId={loadingJobId}
            onGoUpload={handleGoUpload}
            onOpenSubject={handleOpenSubject}
            t={tDashboard}
          />
          <DailyProgressCard dailyGoalProgress={dailyGoalProgress} t={tDashboard} />
        </section>

        <LibrarySection
          subjects={dashboardSubjects}
          loading={loading}
          loadingJobId={loadingJobId}
          deletingJobId={deletingJobId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onGoUpload={handleGoUpload}
          onOpenSubject={handleOpenSubject}
          onDelete={handleDeleteClick}
          onRetry={retry}
          onCancel={cancel}
          busyJobId={busyJobId}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          t={tDashboard}
        />
      </main>

      <FloatingUploadAction onClick={handleGoUpload} t={tDashboard} />

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
