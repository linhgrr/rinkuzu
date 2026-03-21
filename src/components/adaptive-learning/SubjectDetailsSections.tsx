'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import {
  HiArrowRight,
  HiOutlineAcademicCap,
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCollection,
  HiOutlineLightningBolt,
  HiOutlineTrendingUp,
} from '@/components/icons'
import type { SessionHistoryDetail, SessionStatus } from './types'

function SectionSkeleton() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
    </div>
  )
}

const KnowledgeGraph = dynamic(() => import('./KnowledgeGraph'), {
  loading: SectionSkeleton,
})

const MasteryMatrix = dynamic(() => import('./MasteryMatrix'), {
  loading: SectionSkeleton,
})

const ExerciseHistoryTable = dynamic(
  () => import('./SessionHistory').then(module => ({ default: module.ExerciseHistoryTable })),
  {
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    ),
    ssr: false,
  },
)

const TAB_CONFIG = [
  { key: 'graph' as const, icon: HiOutlineCollection, labelKey: 'knowledgeGraph.title' },
  { key: 'mastery' as const, icon: HiOutlineChartBar, labelKey: 'masteryMatrix.title' },
  { key: 'history' as const, icon: HiOutlineClipboardList, labelKey: 'history.title' },
] as const

type SubjectTab = typeof TAB_CONFIG[number]['key']
type TranslateFn = (key: string, values?: Record<string, any>) => string

export const SubjectDetailsBackButton = ({
  onClick,
  t,
}: {
  onClick: () => void
  t: TranslateFn
}) => (
  <div>
    <Button
      variant="ghost"
      onClick={onClick}
      className="-ml-4 mb-4 min-h-[44px] gap-2 px-4 font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    >
      <HiOutlineArrowLeft className="h-5 w-5" />
      {t('subjectDetails.backToDashboard')}
    </Button>
  </div>
)

export const SubjectDetailsHero = ({
  filename,
  loading,
  onPrefetchStartLearning,
  onStartLearning,
  status,
  summary,
  t,
}: {
  filename: string
  loading: boolean
  onPrefetchStartLearning: () => void
  onStartLearning: () => void
  status: SessionStatus | null
  summary: string
  t: TranslateFn
}) => (
  <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-10">
    <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-[14px] border border-slate-100 bg-slate-50 p-3 shadow-xs sm:p-3.5">
          <HiOutlineBookOpen className="h-6 w-6 text-slate-900 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
            {filename}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">{summary}</p>
        </div>
      </div>
      <div className="shrink-0">
        <Button
          onClick={onStartLearning}
          onMouseEnter={onPrefetchStartLearning}
          onFocus={onPrefetchStartLearning}
          className="h-11 min-h-[44px] w-full gap-2 rounded-full bg-teal-600 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-700 focus:ring-teal-500 active:scale-95 sm:w-auto sm:hover:scale-105 md:w-auto"
        >
          <HiOutlineLightningBolt className="h-4 w-4" />
          {t('subjectDetails.startLearning')}
          <HiArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>

    {status ? (
      <div className="relative mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SubjectStatCard icon={HiOutlineCollection} label={t('stats.concepts')} value={status.total_concepts} />
        <SubjectStatCard icon={HiOutlineCheckCircle} label={t('stats.accuracyRate')} value={`${Math.round(status.accuracy * 100)}%`} />
        <SubjectStatCard icon={HiOutlineTrendingUp} label={t('stats.averageMastery')} value={`${Math.round(status.avg_mastery * 100)}%`} />
        <SubjectStatCard icon={HiOutlineAcademicCap} label={t('stats.correctTotal')} value={`${status.total_correct}/${status.total_answered}`} />
      </div>
    ) : loading ? (
      <div className="relative mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
            <div className="mb-3 h-3 w-24 rounded bg-slate-200" />
            <div className="h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    ) : null}
  </div>
)

const SubjectStatCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HiOutlineCollection
  label: string
  value: number | string
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="text-2xl font-mono text-slate-900">{value}</div>
  </div>
)

export const SubjectDetailsTabs = ({
  activeTab,
  onChange,
  t,
}: {
  activeTab: SubjectTab
  onChange: (tab: SubjectTab) => void
  t: TranslateFn
}) => (
  <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-fit [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
    <div className="flex gap-1">
      {TAB_CONFIG.map(({ key, icon: Icon, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-[6px] px-4 py-2 text-sm font-medium transition-all duration-200 ${
            activeTab === key
              ? 'border border-slate-200/50 bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {t(labelKey)}
        </button>
      ))}
    </div>
  </div>
)

export const SubjectDetailsTabContent = ({
  activeTab,
  historyDetail,
  historyLoading,
  sessionId,
  t,
}: {
  activeTab: SubjectTab
  historyDetail: SessionHistoryDetail | null
  historyLoading: boolean
  sessionId: string
  t: TranslateFn
}) => (
  <div className="space-y-8">
    {activeTab === 'graph' && <KnowledgeGraph sessionId={sessionId} />}
    {activeTab === 'mastery' && <MasteryMatrix sessionId={sessionId} filterActiveOnly />}
    {activeTab === 'history' && (
      historyLoading
        ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              <span className="text-sm">{t('history.loadingFromMongoDB')}</span>
            </div>
          )
        : historyDetail
          ? <ExerciseHistoryTable exercises={historyDetail.exercise_history} />
          : (
              <div className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm">
                <HiOutlineClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {t('history.noMongoDBData')}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {t('history.sessionSaveHint')}
                </p>
              </div>
            )
    )}
  </div>
)
