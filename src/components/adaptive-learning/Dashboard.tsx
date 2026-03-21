'use client'

import { useMemo } from 'react'
import { Inter } from 'next/font/google'
import { useTranslations } from 'next-intl'
import {
  DashboardDeleteModal,
  DashboardHeader,
  DashboardToast,
  DailyProgressCard,
  FloatingUploadAction,
  HeroSection,
  LibrarySection,
  RecommendationsSection,
} from './DashboardSections'
import { useAdaptiveDashboard } from './hooks/use-adaptive-dashboard'
import { toDashboardSubject } from './dashboard-view-model'
import type { PipelineJobHistoryItem, SessionHistoryItem } from './types'

const inter = Inter({ subsets: ['latin'] })

interface DashboardProps {
  initialSubjects: PipelineJobHistoryItem[]
  initialSessionHistory: SessionHistoryItem[]
  didHydrateFromServer?: boolean
}

export default function AdaptiveLearningDashboard({
  initialSubjects,
  initialSessionHistory,
  didHydrateFromServer = false,
}: DashboardProps) {
  const tAdaptive = useTranslations('adaptiveLearning')
  const tDashboard = useTranslations('adaptiveLearning.dashboard')
  const locale = tAdaptive('common.locale_date')

  const {
    apiOnline,
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
    searchQuery,
    setSearchQuery,
    streakDays,
    toastMsg,
    upNextSubject,
  } = useAdaptiveDashboard({
    initialSubjects,
    initialSessionHistory,
    didHydrateFromServer,
    t: tDashboard,
    tAdaptive,
  })

  const dashboardSubjects = useMemo(
    () => filteredSubjects.map(subject => toDashboardSubject(subject, locale, tDashboard)),
    [filteredSubjects, locale, tDashboard],
  )

  const upNextDashboardSubject = useMemo(
    () => (upNextSubject ? toDashboardSubject(upNextSubject, locale, tDashboard) : null),
    [locale, tDashboard, upNextSubject],
  )

  return (
    <div className={`${inter.className} min-h-screen bg-[#faf8ff] text-[#131b2e]`}>
      <DashboardToast toastMsg={toastMsg} />

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
          t={tDashboard}
        />

        <RecommendationsSection t={tDashboard} />
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
  )
}
