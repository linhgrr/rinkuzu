'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FiAward, FiBookOpen, FiSearch, FiTarget, FiUploadCloud, FiZap } from 'react-icons/fi'
import { FcFlashOn, FcSportsMode } from 'react-icons/fc'
import { SkeletonCard } from './Skeletons'
import { SubjectCard } from './SubjectCard'
import type { PipelineJobHistoryItem, SessionHistoryItem } from './types'

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ToastProps = {
  toastMsg: { title: string; type: 'error' | 'success' } | null
}

export const DashboardToast = ({ toastMsg }: ToastProps) => {
  const t = useTranslations('adaptiveLearning')

  if (!toastMsg)
    return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl border shadow-lg flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-5 ${toastMsg.type === 'error' ? 'bg-white border-red-200 text-neutral-900' : 'bg-brand-trust text-white border-transparent'}`}>
      {toastMsg.type === 'error'
        ? <FiZap className="text-red-500 w-5 h-5 shrink-0" aria-hidden="true" />
        : (
            <div className="w-10 h-10 shrink-0 bg-white/10 rounded-full flex items-center justify-center p-1">
              <Image src="/images/mascot_image.png" alt={t('dashboard.mascotAlt')} width={40} height={40} className="w-full h-full object-contain" />
            </div>
          )}
      <span className="text-sm font-medium">{toastMsg.title}</span>
    </div>
  )
}

type HeaderProps = {
  apiOnline: boolean | null
  dailyGoalProgress: { current: number; total: number; percent: number }
  error: string | null
  streakDays: number
  t: TranslateFn
}

export const DashboardHeader = ({ apiOnline, dailyGoalProgress, error, streakDays, t }: HeaderProps) => (
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-200">
    <div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900">{t('dashboard.welcomeBack')}</h1>
      <p className="text-neutral-600 mt-2 text-base max-w-xl">{t('dashboard.pickUpDescription')}</p>
      {apiOnline === false && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-50 border border-orange-100 text-orange-600 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          {t('dashboard.connectionLimited')}
        </div>
      )}
      {error && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {error}
        </div>
      )}
    </div>

    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-neutral-200 shadow-sm">
        <FiZap className="w-4 h-4 text-brand-trust shrink-0" aria-hidden="true" />
        <span className="font-bold text-sm text-brand-trust tracking-tight">{t('dashboard.dayStreak', { count: streakDays })}</span>
      </div>

      <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-full border border-neutral-200 shadow-sm min-w-[140px] md:min-w-[160px]">
        <FiTarget className="text-neutral-500 w-4 h-4 shrink-0" aria-label={t('dashboard.goalAriaLabel')} />
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-neutral-700 tracking-wider">
              {t('dashboard.dailyGoalProgress', { current: dailyGoalProgress.current, total: dailyGoalProgress.total })}
            </span>
          </div>
          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-trust rounded-full transition-all duration-500" style={{ width: `${dailyGoalProgress.percent}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  </header>
)

type UpNextProps = {
  loading: boolean
  upNextSubject: PipelineJobHistoryItem | null
  loadingJobId: string | null
  onGoUpload: () => void
  onOpenSubject: (jobId: string) => void
  t: TranslateFn
}

export const UpNextSection = ({ loading, upNextSubject, loadingJobId, onGoUpload, onOpenSubject, t }: UpNextProps) => {
  if (loading && !upNextSubject) {
    return (
      <section className="bg-white rounded-3xl p-8 md:p-10 border border-neutral-200 shadow-sm relative overflow-hidden hidden md:block animate-pulse h-64">
        <div className="h-4 bg-neutral-100 rounded w-24 mb-6"></div>
        <div className="h-8 bg-neutral-100 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-neutral-50 rounded w-3/4 mb-10"></div>
        <div className="h-12 bg-neutral-100 rounded-xl w-40"></div>
      </section>
    )
  }

  if (upNextSubject) {
    return (
      <section className="bg-white rounded-3xl p-8 md:p-10 border border-neutral-200 shadow-sm hover:border-brand-trust/40 hover:shadow-[var(--shadow-green-glow)] transition-all duration-500 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4 pointer-events-none"></div>

        <div className="absolute right-0 bottom-0 pointer-events-none hidden sm:block opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-2 z-0">
          <Image src="/images/mascot_image.png" alt={t('dashboard.mascotAlt')} width={288} height={288} className="w-64 h-64 md:w-72 md:h-72 object-contain" />
        </div>

        <div className="relative z-10 flex flex-col items-start gap-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-100 text-brand-trust-hover text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">{t('dashboard.upNext')}</span>
            <span className="text-brand-trust text-sm font-medium">{t('dashboard.continueLearning')}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight leading-snug">
            {upNextSubject.subject_id || upNextSubject.filename.replace(/\.[^.]+$/, '')}
          </h2>
          <p className="text-neutral-600 mb-6 max-w-[420px] leading-relaxed text-base">{t('dashboard.nextLevelDescription')}</p>
          <Button
            onClick={() => onOpenSubject(upNextSubject.job_id)}
            disabled={loadingJobId === upNextSubject.job_id}
            className="bg-brand-action hover:bg-brand-action-hover text-white font-medium py-3.5 px-8 rounded-xl flex items-center justify-center gap-2.5 shadow-lg hover:shadow-[var(--shadow-orange-glow)] border border-brand-action transition-all duration-300 w-full sm:w-auto disabled:opacity-70"
          >
            {loadingJobId === upNextSubject.job_id
              ? <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              : <><FiBookOpen className="w-5 h-5 opacity-80" aria-hidden="true" />{t('dashboard.continueSession')}</>}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-3xl p-10 border border-neutral-200 shadow-sm text-center py-20 flex flex-col items-center">
      <div className="bg-neutral-50 p-5 border border-neutral-100 rounded-2xl mb-6">
        <FiUploadCloud className="text-neutral-400 w-8 h-8" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold mb-3 text-neutral-900 tracking-tight">{t('dashboard.uploadMaterialTitle')}</h2>
      <p className="text-neutral-600 mb-8 max-w-sm mx-auto">{t('dashboard.uploadMaterialHint')}</p>
      <Button onClick={onGoUpload} className="bg-brand-action hover:bg-brand-action-hover text-white font-medium py-3.5 px-8 rounded-xl inline-flex items-center justify-center gap-2.5 shadow-lg hover:shadow-[var(--shadow-orange-glow)] border border-brand-action transition-all duration-300">
        <FiUploadCloud className="w-5 h-5 opacity-80" aria-hidden="true" />
        {t('dashboard.uploadDocument')}
      </Button>
    </section>
  )
}

type LibraryProps = {
  loading: boolean
  filteredSubjects: PipelineJobHistoryItem[]
  loadingJobId: string | null
  deletingJobId: string | null
  searchQuery: string
  setSearchQuery: (value: string) => void
  onGoUpload: () => void
  onOpenSubject: (jobId: string) => void
  onDelete: (job: PipelineJobHistoryItem) => void
  t: TranslateFn
}

export const LibrarySection = ({
  loading,
  filteredSubjects,
  loadingJobId,
  deletingJobId,
  searchQuery,
  setSearchQuery,
  onGoUpload,
  onOpenSubject,
  onDelete,
  t,
}: LibraryProps) => (
  <section className="bg-white rounded-3xl p-8 md:p-10 border border-neutral-200 shadow-sm overflow-hidden flex flex-col items-stretch">
    <div className="flex flex-col sm:flex-row sm:items-start lg:items-center justify-between gap-4 mb-8">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2.5 text-neutral-900 tracking-tight">
          <FiBookOpen className="text-neutral-400 w-5 h-5" aria-hidden="true" />
          {t('dashboard.yourLibrary')}
        </h3>
        <p className="text-xs text-neutral-600 mt-2">{t('dashboard.libraryDescription')}</p>
      </div>
      <div className="flex flex-row gap-3 items-center w-full sm:w-auto">
        <div className="relative w-full sm:w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          <input
            type="text"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-trust focus:bg-white transition-all"
            aria-label={t('dashboard.searchAriaLabel')}
          />
        </div>
        <Button
          onClick={onGoUpload}
          className="bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm whitespace-nowrap"
          title={t('dashboard.uploadNewDocumentTitle')}
        >
          <FiUploadCloud className="w-4 h-4 opacity-70" aria-hidden="true" />
          <span className="hidden md:inline text-sm">{t('uploadPage.upload')}</span>
        </Button>
      </div>
    </div>

    {loading
      ? (
          <div className="flex flex-col pb-4 mt-2">
            {[1, 2, 3].map(i => <SkeletonCard key={`skel-${i}`} />)}
          </div>
        )
      : filteredSubjects.length === 0
        ? (
            <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-neutral-200">
                <FiBookOpen className="w-5 h-5 text-neutral-400" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">{t('dashboard.noDocumentsTitle')}</h3>
              <p className="text-xs text-neutral-600 mt-1 max-w-[200px] mx-auto">{t('dashboard.noDocumentsDescription')}</p>
            </div>
          )
        : (
            <div className="flex flex-col pb-4 mt-2">
              {filteredSubjects.map((job, idx) => (
                <SubjectCard
                  key={job.job_id}
                  job={job}
                  index={idx}
                  onOpen={onOpenSubject}
                  onDelete={onDelete}
                  loading={loadingJobId === job.job_id}
                  deleting={deletingJobId === job.job_id}
                />
              ))}
            </div>
          )}
  </section>
)

type RightSidebarProps = {
  sessionHistory: SessionHistoryItem[]
  t: TranslateFn
}

export const RightSidebar = ({ sessionHistory, t }: RightSidebarProps) => (
  <div className="space-y-8 md:space-y-10">
    <section className="bg-white rounded-3xl p-6 md:p-8 border border-neutral-200 shadow-sm">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-neutral-900 tracking-tight">
        <FiTarget className="text-neutral-400 w-5 h-5" aria-hidden="true" />
        {t('dashboard.dailyQuests')}
      </h3>
      <ul className="space-y-5">
        <li className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><FiZap className="text-amber-500 w-4 h-4" /></div>
          <div className="flex-1 mt-1.5"><p className="text-sm font-semibold text-neutral-900">{t('dashboard.completeOneLesson')}</p><p className="text-xs text-neutral-500 mt-1 font-mono">10 XP</p></div>
        </li>
        <li className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0"><FiTarget className="text-rose-500 w-4 h-4" /></div>
          <div className="flex-1 mt-1.5"><p className="text-sm font-semibold text-neutral-900">{t('dashboard.achieveAccuracy')}</p><p className="text-xs text-neutral-500 mt-1 font-mono">20 XP</p></div>
        </li>
      </ul>
    </section>

    <section className="bg-white rounded-3xl p-6 md:p-8 border border-neutral-200 shadow-sm">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-neutral-900 tracking-tight">
        <FiAward className="text-neutral-400 w-5 h-5" aria-hidden="true" />
        {t('dashboard.recentBadges')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-b from-amber-50 to-orange-50 p-5 rounded-2xl border border-orange-100 text-center">
          <div className="text-4xl mb-3 flex items-center justify-center"><FcFlashOn className="w-12 h-12" /></div>
          <p className="text-[13px] font-bold text-neutral-900 tracking-tight">{t('dashboard.fastLearner')}</p>
          <p className="text-[11px] text-neutral-600 mt-1 font-medium">{t('dashboard.lessonsToday', { count: 3 })}</p>
        </div>
        <div className="bg-gradient-to-b from-green-50 to-neutral-50 p-5 rounded-2xl border border-green-100 text-center">
          <div className="text-4xl mb-3 flex items-center justify-center"><FcSportsMode className="w-12 h-12" /></div>
          <p className="text-[13px] font-bold text-neutral-900 tracking-tight">{t('dashboard.perfectScore')}</p>
          <p className="text-[11px] text-neutral-600 mt-1 font-medium">{t('dashboard.accuracyBadge')}</p>
        </div>
      </div>
    </section>

    <section className="px-2">
      <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-6">{t('dashboard.activityHistory')}</h3>
      <div className="relative border-l border-neutral-200 ml-2.5 space-y-8">
        {sessionHistory.length > 0
          ? sessionHistory.map((h, i) => (
              <div key={h.job_id} className="relative pl-6">
                <div className={`absolute w-2 h-2 bg-white border-2 ${i === 0 ? 'border-brand-trust shadow-sm' : 'border-neutral-300'} rounded-full -left-[4.5px] top-1.5`}></div>
                <p className="text-sm font-semibold text-neutral-900">{h.subject_id || h.filename || t('dashboard.learningSession')}</p>
                <p className="text-xs text-neutral-500 font-medium flex items-center gap-1.5 mt-1">{t('dashboard.accQs', { acc: Math.round(h.accuracy * 100), count: h.total_answered })}</p>
              </div>
            ))
          : (
              <>
                <div className="relative pl-6">
                  <div className="absolute w-2 h-2 bg-white border-2 border-brand-trust shadow-sm rounded-full -left-[4.5px] top-1.5"></div>
                  <p className="text-sm font-semibold text-neutral-900">{t('dashboard.masteredReactState')}</p>
                  <p className="text-xs text-neutral-500 mt-1.5 font-medium">{t('dashboard.hoursAgo', { count: 2 })}</p>
                </div>
                <div className="relative pl-6">
                  <div className="absolute w-2 h-2 bg-white border-2 border-neutral-300 rounded-full -left-[4.5px] top-1.5"></div>
                  <p className="text-sm font-medium text-neutral-500">{t('dashboard.completedDailyGoal')}</p>
                  <p className="text-xs text-neutral-400 mt-1.5 font-medium">{t('dashboard.yesterday')}</p>
                </div>
              </>
            )}
      </div>
    </section>
  </div>
)

type DeleteModalProps = {
  isOpen: boolean
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TranslateFn
}

export const DashboardDeleteModal = ({ isOpen, isLoading, onConfirm, onCancel, t }: DeleteModalProps) => (
  <ConfirmModal
    isOpen={isOpen}
    title={t('dashboard.deleteDocumentTitle')}
    message={<span className="text-neutral-500 text-sm">{t('dashboard.deleteConfirmDescription')}</span>}
    confirmText={t('dashboard.deleteMaterial')}
    cancelText={t('common.cancel')}
    confirmVariant="destructive"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
  />
)
