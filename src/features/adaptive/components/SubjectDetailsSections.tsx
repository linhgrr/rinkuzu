'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { TabBar } from '@/components/ui/TabBar';
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
} from 'react-icons/hi';
import type { SessionHistoryDetail } from '@/features/adaptive/types/history';
import type { SessionStatus, TranslateFn } from '@/features/adaptive/types/learning';

function SectionSkeleton() {
  return <PanelBlockSkeleton label="Loading section" />;
}

const KnowledgeGraph = dynamic(() => import('./KnowledgeGraph'), {
  loading: SectionSkeleton,
});

const MasteryMatrix = dynamic(() => import('./MasteryMatrix'), {
  loading: SectionSkeleton,
});

const ExerciseHistoryTable = dynamic(
  () =>
    import('./ExerciseHistoryTable').then((module) => ({ default: module.ExerciseHistoryTable })),
  {
    loading: () => <PanelBlockSkeleton label="Loading exercise history" />,
    ssr: false,
  },
);

const TAB_CONFIG = [
  { key: 'graph' as const, icon: HiOutlineCollection, labelKey: 'knowledgeGraph.title' },
  { key: 'mastery' as const, icon: HiOutlineChartBar, labelKey: 'masteryMatrix.title' },
  { key: 'history' as const, icon: HiOutlineClipboardList, labelKey: 'history.title' },
] as const;

type SubjectTab = (typeof TAB_CONFIG)[number]['key'];

interface SubjectDetailsBackButtonProps {
  onClick: () => void;
  t: TranslateFn;
}

interface SubjectDetailsHeroProps {
  filename: string;
  loading: boolean;
  onPrefetchStartLearning: () => void;
  onStartLearning: () => void;
  sessionNotice: string | null;
  startingSession: boolean;
  status: SessionStatus | null;
  summary: string;
  t: TranslateFn;
}

interface SubjectStatCardProps {
  icon: typeof HiOutlineCollection;
  label: string;
  value: number | string;
}

interface SubjectDetailsTabsProps {
  activeTab: SubjectTab;
  onChange: (tab: SubjectTab) => void;
  t: TranslateFn;
}

interface SubjectDetailsTabContentProps {
  activeTab: SubjectTab;
  historyDetail: SessionHistoryDetail | null;
  historyLoading: boolean;
  sessionId: string;
  t: TranslateFn;
}

export const SubjectDetailsBackButton = ({ onClick, t }: SubjectDetailsBackButtonProps) => (
  <div>
    <Button
      variant="ghost"
      onClick={onClick}
      className="-ml-4 mb-4 min-h-[44px] gap-2 bg-transparent px-4 font-medium text-ink-muted hover:bg-accent-soft/25 hover:text-ink"
    >
      <HiOutlineArrowLeft className="size-5" />
      {t('subjectDetails.backToDashboard')}
    </Button>
  </div>
);

export const SubjectDetailsHero = ({
  filename,
  loading,
  onPrefetchStartLearning,
  onStartLearning,
  sessionNotice,
  startingSession,
  status,
  summary,
  t,
}: SubjectDetailsHeroProps) => (
  <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 shadow-sm sm:p-8 md:p-10">
    <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 p-3 shadow-xs sm:p-3.5">
          <HiOutlineBookOpen className="h-6 w-6 text-neutral-900 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h1 className="mb-1.5 text-xl font-bold tracking-tight text-ink sm:text-2xl md:text-3xl">
            {filename}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-500 sm:text-base">
            {summary}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <Button
          onClick={onStartLearning}
          onMouseEnter={onPrefetchStartLearning}
          onFocus={onPrefetchStartLearning}
          disabled={startingSession}
          className="min-h-[44px] w-full gap-2 rounded-full bg-brand-action px-6 text-sm font-medium text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-brand-action-hover active:scale-95 sm:w-auto sm:hover:scale-105 md:w-auto"
        >
          {startingSession ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t('dashboard.creatingSession')}
            </>
          ) : (
            <>
              <HiOutlineLightningBolt className="size-4" />
              {status && status.total_answered > 0
                ? t('dashboard.continueLearning')
                : t('subjectDetails.startLearning')}
              <HiArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>

    {sessionNotice && (
      <div className="relative mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {sessionNotice}
      </div>
    )}

    {status ? (
      <div className="relative mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SubjectStatCard
          icon={HiOutlineCollection}
          label={t('stats.concepts')}
          value={status.total_concepts}
        />
        <SubjectStatCard
          icon={HiOutlineCheckCircle}
          label={t('stats.accuracyRate')}
          value={`${Math.round(status.accuracy * 100)}%`}
        />
        <SubjectStatCard
          icon={HiOutlineTrendingUp}
          label={t('stats.averageMastery')}
          value={`${Math.round(status.avg_mastery * 100)}%`}
        />
        <SubjectStatCard
          icon={HiOutlineAcademicCap}
          label={t('stats.correctTotal')}
          value={`${status.total_correct}/${status.total_answered}`}
        />
      </div>
    ) : loading ? (
      <div className="relative mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse rounded-xl border border-neutral-100 bg-neutral-50 px-5 py-4"
          >
            <div className="mb-3 h-3 w-24 rounded bg-neutral-200" />
            <div className="h-8 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    ) : null}
  </div>
);

const SubjectStatCard = ({ icon: Icon, label, value }: SubjectStatCardProps) => (
  <div className="rounded-xl border border-line bg-surface-warm px-5 py-4">
    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
      <Icon className="size-3.5" />
      {label}
    </div>
    <div className="text-2xl font-mono text-neutral-900">{value}</div>
  </div>
);

export const SubjectDetailsTabs = ({ activeTab, onChange, t }: SubjectDetailsTabsProps) => (
  <TabBar
    ariaLabel={t('subjectDetails.tabsLabel')}
    value={activeTab}
    onChange={onChange}
    options={TAB_CONFIG.map(({ key, icon: Icon, labelKey }) => ({
      value: key,
      label: t(labelKey),
      icon: <Icon className="size-4" aria-hidden="true" />,
      tabId: `tab-${key}`,
      controlsId: `tabpanel-${key}`,
    }))}
  />
);

export const SubjectDetailsTabContent = ({
  activeTab,
  historyDetail,
  historyLoading,
  sessionId,
  t,
}: SubjectDetailsTabContentProps) => (
  <div
    className="space-y-8"
    role="tabpanel"
    id={`tabpanel-${activeTab}`}
    aria-labelledby={`tab-${activeTab}`}
  >
    {activeTab === 'graph' && <KnowledgeGraph sessionId={sessionId} />}
    {activeTab === 'mastery' && <MasteryMatrix sessionId={sessionId} filterActiveOnly />}
    {activeTab === 'history' &&
      (historyLoading ? (
        <PanelBlockSkeleton label={t('history.loadingFromMongoDB')} />
      ) : historyDetail ? (
        <ExerciseHistoryTable exercises={historyDetail.exercise_history} />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white py-12 text-center shadow-sm">
          <HiOutlineClipboardList className="mx-auto mb-3 size-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">{t('history.noMongoDBData')}</p>
          <p className="mt-1 text-xs text-neutral-400">{t('history.sessionSaveHint')}</p>
        </div>
      ))}
  </div>
);
