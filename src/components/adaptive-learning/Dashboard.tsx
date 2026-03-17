'use client'

import { useTranslations } from 'next-intl'
import {
  DashboardDeleteModal,
  DashboardHeader,
  DashboardToast,
  LibrarySection,
  RightSidebar,
  UpNextSection,
} from './dashboard-sections'
import { useAdaptiveDashboard } from './hooks/use-adaptive-dashboard'
import type { PipelineJobHistoryItem, SessionHistoryItem } from './types'

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
  const t = useTranslations('adaptiveLearning')

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
    sessionHistory,
    setSearchQuery,
    streakDays,
    toastMsg,
    upNextSubject,
  } = useAdaptiveDashboard({
    initialSubjects,
    initialSessionHistory,
    didHydrateFromServer,
    t,
  })

  return (
    <div className="font-sans text-slate-900 selection:bg-slate-200">
      <DashboardToast toastMsg={toastMsg} />

      <div className="mx-auto max-w-6xl space-y-10">
        <DashboardHeader
          apiOnline={apiOnline}
          dailyGoalProgress={dailyGoalProgress}
          error={error}
          streakDays={streakDays}
          t={t}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
          <div className="lg:col-span-2 space-y-8 md:space-y-10">
            <UpNextSection
              loading={loading}
              upNextSubject={upNextSubject}
              loadingJobId={loadingJobId}
              onGoUpload={handleGoUpload}
              onOpenSubject={handleOpenSubject}
              t={t}
            />

            <LibrarySection
              loading={loading}
              filteredSubjects={filteredSubjects}
              loadingJobId={loadingJobId}
              deletingJobId={deletingJobId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onGoUpload={handleGoUpload}
              onOpenSubject={handleOpenSubject}
              onDelete={handleDeleteClick}
              t={t}
            />
          </div>

          <RightSidebar sessionHistory={sessionHistory} t={t} />
        </div>

        <div className="pb-12 md:pb-20"></div>
      </div>

      <DashboardDeleteModal
        isOpen={!!itemToDelete}
        isLoading={!!deletingJobId}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        t={t}
      />
    </div>
  )
}
