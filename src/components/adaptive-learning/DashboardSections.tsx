'use client'

import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import {
  FiArrowRight,
  FiBookOpen,
  FiClock,
  FiGrid,
  FiList,
  FiPlay,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiZap,
} from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useRandomLibraryImages } from './hooks/use-random-library-images'
import type { DashboardSubject } from './dashboard-view-model'
import type { PipelineJobHistoryItem } from './types'

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] })

const DASHBOARD_RECOMMENDATIONS = [
  {
    badgeKey: 'recommendations.basedOnActivity.badge',
    titleKey: 'recommendations.basedOnActivity.title',
    descriptionKey: 'recommendations.basedOnActivity.description',
    durationKey: 'recommendations.basedOnActivity.duration',
  },
  {
    badgeKey: 'recommendations.highImpact.badge',
    titleKey: 'recommendations.highImpact.title',
    descriptionKey: 'recommendations.highImpact.description',
    durationKey: 'recommendations.highImpact.duration',
  },
  {
    badgeKey: 'recommendations.communityTop.badge',
    titleKey: 'recommendations.communityTop.title',
    descriptionKey: 'recommendations.communityTop.description',
    durationKey: 'recommendations.communityTop.duration',
  },
] as const

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ToastProps = {
  toastMsg: { title: string; type: 'error' | 'success' } | null
}

type DashboardHeaderProps = {
  apiOnline: boolean | null
  dailyGoalProgress: { current: number; total: number; percent: number }
  error: string | null
  streakDays: number
  t: TranslateFn
}

type HeroProps = {
  subject: DashboardSubject | null
  loading: boolean
  loadingJobId: string | null
  onGoUpload: () => void
  onOpenSubject: (jobId: string) => void
  t: TranslateFn
}

type DailyProgressCardProps = {
  dailyGoalProgress: { current: number; total: number; percent: number }
  t: TranslateFn
}

type LibraryProps = {
  subjects: DashboardSubject[]
  loading: boolean
  loadingJobId: string | null
  deletingJobId: string | null
  searchQuery: string
  setSearchQuery: (value: string) => void
  onGoUpload: () => void
  onOpenSubject: (jobId: string) => void
  onDelete: (job: PipelineJobHistoryItem) => void
  t: TranslateFn
}

type SubjectLibraryCardProps = {
  subject: DashboardSubject
  index: number
  loading: boolean
  deleting: boolean
  imageUrl?: string
  onOpenSubject: (jobId: string) => void
  onDelete: (job: PipelineJobHistoryItem) => void
  t: TranslateFn
}

type DashboardDeleteModalProps = {
  cancelText: string
  isOpen: boolean
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TranslateFn
}

type FloatingUploadActionProps = {
  onClick: () => void
  t: TranslateFn
}

const DashboardStatusPill = ({
  tone,
  text,
}: {
  tone: 'error' | 'warning'
  text: string
}) => (
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
)

export const DashboardToast = ({ toastMsg }: ToastProps) => {
  if (!toastMsg)
    return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-[1.25rem] border px-5 py-4 shadow-lg backdrop-blur ${toastMsg.type === 'error' ? 'border-red-200 bg-white/95 text-neutral-900' : 'border-transparent bg-brand-trust/95 text-white'}`}>
      {toastMsg.type === 'error'
        ? <FiZap className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
        : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><FiBookOpen className="h-5 w-5" aria-hidden="true" /></div>}
      <span className="text-sm font-medium">{toastMsg.title}</span>
    </div>
  )
}

export const DashboardHeader = ({
  apiOnline,
  dailyGoalProgress,
  error,
  streakDays,
  t,
}: DashboardHeaderProps) => (
  <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
    <div>
      <span className={`${plusJakartaSans.className} text-3xl font-black text-neutral-900`}>Adaptive Scholar</span>
      <p className="mt-1 font-medium text-neutral-600">{t('brandSubtitle')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {apiOnline === false && <DashboardStatusPill tone="warning" text={t('connectionLimited')} />}
        {error && <DashboardStatusPill tone="error" text={error} />}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2">
        <FiZap className="h-4 w-4 text-brand-trust" aria-hidden="true" />
        <span className="text-sm font-bold text-neutral-900">{t('dayStreak', { count: streakDays })}</span>
      </div>
      <div className="flex min-w-[9.5rem] items-center gap-3 rounded-full border border-neutral-300/60 bg-white px-4 py-2 shadow-sm">
        <FiClock className="h-4 w-4 text-brand-trust" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-600">
            {t('dailyGoalProgress', { current: dailyGoalProgress.current, total: dailyGoalProgress.total })}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-brand-trust" style={{ width: `${dailyGoalProgress.percent}%` }} />
          </div>
        </div>
      </div>
      {/* <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-brand-trust-hover bg-green-50">
        <Image src="/images/mascot_image.png" alt={t('avatarAlt')} width={48} height={48} className="h-full w-full object-contain" />
      </div> */}
    </div>
  </div>
)

export const HeroSection = ({ subject, loading, loadingJobId, onGoUpload, onOpenSubject, t }: HeroProps) => {
  if (loading && !subject)
    return <section className="h-[23rem] animate-pulse rounded-[1.75rem] border border-neutral-300/60 bg-white/60 lg:col-span-8" />

  if (!subject) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-gradient-to-br from-green-50 to-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
          <div>
            <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
              {t('activeJourney')}
            </span>
            <h1 className={`${plusJakartaSans.className} text-4xl font-black leading-tight text-neutral-900 md:text-5xl`}>
              {t('uploadMaterialTitle')}
            </h1>
            <p className="mt-3 text-lg font-medium text-neutral-600">{t('uploadMaterialHint')}</p>
          </div>
          <Button onClick={onGoUpload} className="rounded-full bg-brand-action px-10 py-4 text-white shadow-lg shadow-[var(--shadow-orange-glow)] hover:bg-brand-action-hover">
            <FiUploadCloud className="h-5 w-5" />
            {t('uploadDocument')}
          </Button>
        </div>
        <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl" />
      </section>
    )
  }

  const isOpening = loadingJobId === subject.job_id

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-gradient-to-br from-green-50 to-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
      <div className="relative z-10 flex h-full flex-col justify-between gap-10">
        <div>
          <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
            {t('activeJourney')}
          </span>
          <h1 className={`${plusJakartaSans.className} text-4xl font-black leading-tight text-neutral-900 md:text-5xl`}>
            {subject.displayTitle}
          </h1>
          <p className="mt-3 text-lg font-medium text-neutral-600">{t('pickUpDescription')}</p>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-4">
            <span className="text-lg font-bold text-brand-trust">{t('completePercent', { percent: subject.metrics.progressPercent })}</span>
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
              <FiPlay className="h-5 w-5" />
              {isOpening ? t('creatingSession') : t('continueLearning')}
            </Button>
            <Button
              onClick={() => onOpenSubject(subject.job_id)}
              disabled={isOpening}
              variant="secondary"
              className="rounded-full border border-neutral-300/70 bg-white/60 px-8 py-4 font-bold text-neutral-900 backdrop-blur hover:bg-white"
            >
              {t('viewSyllabus')}
            </Button>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl transition-all duration-700" />
    </section>
  )
}

export const DailyProgressCard = ({ dailyGoalProgress, t }: DailyProgressCardProps) => (
  <section className="flex h-full flex-col justify-between rounded-[1.75rem] border border-neutral-200 bg-white p-8 shadow-sm lg:col-span-4">
    <div>
      <h2 className={`${plusJakartaSans.className} mb-8 text-3xl font-bold text-neutral-900`}>{t('dailyProgressTitle')}</h2>
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 shadow-inner">
            <FiZap className="h-6 w-6 text-brand-trust" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">{t('earnedToday')}</p>
            <p className="text-2xl font-extrabold text-neutral-900">1,250 XP</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-trust/10 shadow-inner">
            <FiBookOpen className="h-6 w-6 text-brand-trust" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">{t('achievements')}</p>
            <p className="text-2xl font-extrabold text-neutral-900">4 {t('unlocked')}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-8 border-t border-neutral-300/60 pt-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-neutral-900">{t('levelArchitect')}</span>
        <span className="text-xs font-medium text-neutral-600">
          {t('dailyGoalProgress', { current: dailyGoalProgress.current, total: dailyGoalProgress.total })}
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
)

const UploadCard = ({ onGoUpload, t }: { onGoUpload: () => void, t: TranslateFn }) => (
  <div className="group flex min-h-[21rem] flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-neutral-300 p-8 text-center transition-all duration-300 hover:border-brand-trust/50 hover:bg-brand-trust/5">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 transition-transform duration-300 group-hover:scale-110">
      <FiUploadCloud className="h-10 w-10 text-brand-action" />
    </div>
    <h3 className="mb-2 text-xl font-bold text-neutral-900">{t('uploadNewPdf')}</h3>
    <p className="mb-6 text-sm text-neutral-600">{t('uploadDragDropHint')}</p>
    <Button onClick={onGoUpload} className="rounded-full bg-brand-action px-8 py-2.5 font-bold text-white shadow-md hover:bg-brand-action-hover">
      {t('chooseFile')}
    </Button>
  </div>
)

const SubjectLibraryCard = ({
  subject,
  index,
  loading,
  deleting,
  onOpenSubject,
  onDelete,
  imageUrl,
  t,
}: SubjectLibraryCardProps) => {
  const progressBarClass = index % 3 === 1 ? 'bg-brand-trust' : 'bg-brand-trust'

  return (
    <div className="flex h-full flex-col justify-between rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <div className="mb-4">
        <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          {imageUrl
            // The image source is discovered at runtime from an external API.
            // Keep a plain img here until the remote host set is stabilized in next.config.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imageUrl} alt={subject.displayTitle} className="h-full w-full object-cover opacity-70" loading="lazy" />
            : <FiBookOpen className="h-12 w-12 text-neutral-300" />}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-neutral-900" title={subject.displayTitle}>{subject.displayTitle}</h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-600">{subject.lastOpenedLabel}</p>
          </div>
          <button
            onClick={() => onDelete(subject)}
            disabled={loading || deleting}
            className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-500"
            aria-label={t('deleteMaterial')}
            title={t('deleteMaterial')}
            type="button"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-brand-trust">
          <span>{subject.metrics.progressPercent}%</span>
          <span>{subject.progressLabel}</span>
        </div>
        <div className="mb-6 h-1.5 w-full rounded-full bg-neutral-100">
          <div className={`h-full rounded-full ${progressBarClass}`} style={{ width: `${subject.metrics.progressPercent}%` }} />
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
  )
}

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
  t,
}: LibraryProps) => {
  const libraryImages = useRandomLibraryImages(subjects.length)

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className={`${plusJakartaSans.className} text-3xl font-black text-neutral-900`}>{t('knowledgeLibrary')}</h2>
          <p className="text-neutral-600">{t('knowledgeLibrarySubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="rounded-full border border-neutral-300/70 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 outline-none transition focus:border-brand-trust focus:ring-2 focus:ring-[var(--focus-ring-soft)]"
            />
          </div>
          <button type="button" className="rounded-full p-3 text-neutral-500 transition-colors hover:bg-neutral-100" aria-label={t('gridView')}>
            <FiGrid className="h-5 w-5" />
          </button>
          <button type="button" className="rounded-full p-3 text-neutral-500 transition-colors hover:bg-neutral-100" aria-label={t('listView')}>
            <FiList className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <UploadCard onGoUpload={onGoUpload} t={t} />
        {loading && subjects.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`library-skeleton-${index}`} className="min-h-[21rem] animate-pulse rounded-[1.75rem] border border-neutral-200 bg-white/60" />
            ))
          : subjects.map((subject, index) => (
              <SubjectLibraryCard
                key={subject.job_id}
                subject={subject}
                index={index}
                imageUrl={libraryImages.length > 0 ? libraryImages[index % libraryImages.length] : undefined}
                loading={loadingJobId === subject.job_id}
                deleting={deletingJobId === subject.job_id}
                onOpenSubject={onOpenSubject}
                onDelete={onDelete}
                t={t}
              />
            ))}
      </div>
    </section>
  )
}

export const RecommendationsSection = ({ t }: { t: TranslateFn }) => (
  <section className="mb-12">
    <div className="mb-8 flex items-center gap-4">
      <h2 className={`${plusJakartaSans.className} text-3xl font-black text-neutral-900`}>{t('recommendedForYou')}</h2>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-trust/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-brand-trust">
        <FiZap className="h-4 w-4" />
        {t('aiPowered')}
      </span>
    </div>
    <div className="-mx-4 flex gap-8 overflow-x-auto px-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {DASHBOARD_RECOMMENDATIONS.map(item => (
        <article key={item.titleKey} className="flex w-96 flex-none flex-col rounded-[1.75rem] border border-white/60 bg-neutral-100 p-8 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-6 flex items-start justify-between gap-4">
            <span className="rounded bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-600">{t(item.badgeKey)}</span>
            <FiZap className="h-5 w-5 text-brand-trust" />
          </div>
          <h4 className="mb-3 text-xl font-bold text-neutral-900">{t(item.titleKey)}</h4>
          <p className="mb-6 leading-relaxed text-neutral-600">{t(item.descriptionKey)}</p>
          <div className="mt-auto flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-neutral-600">
              <FiClock className="h-3.5 w-3.5" />
              {t(item.durationKey)}
            </span>
            <button type="button" className="inline-flex items-center gap-1 text-sm font-bold text-brand-trust transition-all hover:gap-2">
              {t('viewDetails')}
              <FiArrowRight className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  </section>
)

export const FloatingUploadAction = ({ onClick, t }: FloatingUploadActionProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group fixed bottom-10 right-10 z-50 flex h-20 w-20 items-center justify-center rounded-full bg-brand-action text-white shadow-2xl transition-all active:scale-90 hover:w-48 hover:rounded-[2rem]"
    aria-label={t('newLesson')}
    title={t('newLesson')}
  >
    <div className="flex items-center gap-2">
      <FiUploadCloud className="h-8 w-8" />
      <span className="hidden whitespace-nowrap font-bold group-hover:block">{t('newLesson')}</span>
    </div>
  </button>
)

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
)
