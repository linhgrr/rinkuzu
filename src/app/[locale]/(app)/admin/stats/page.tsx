'use client';

import { useEffect, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  fetchAdminStatsViewModel,
  fetchGrowthTrendsViewModel,
} from '@/features/admin/stats/api/admin-stats-api';
import type {
  AdminGrowthPeriodViewModel,
  AdminGrowthTrendsViewModel,
  AdminMetricComparisonViewModel,
  AdminStatsViewModel,
} from '@/features/admin/stats/types/admin-stats-view-model';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatsPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import StatsModal from '@/features/admin/stats/components/StatsModal';
import { LlmUsageSection } from '@/features/admin/stats/components/LlmUsageSection';
import { EntitlementTelemetrySection } from '@/features/admin/stats/components/EntitlementTelemetrySection';
import { KpiSparkline } from '@/features/admin/stats/components/charts/KpiSparkline';
import { GrowthTrendChart } from '@/features/admin/stats/components/charts/GrowthTrendChart';
import { ScoreDistributionChart } from '@/features/admin/stats/components/charts/ScoreDistributionChart';
import { TopCreatorsBarChart } from '@/features/admin/stats/components/charts/TopCreatorsBarChart';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type StatsModalType = 'creators' | 'activity' | null;

interface AdminStatsLayoutProps {
  children: ReactNode;
}

interface AdminStatsErrorBannerProps {
  error: string;
}

interface AdminStatsDataProps {
  stats: AdminStatsViewModel;
  t: TranslateFn;
}

interface TopCreatorsSectionProps extends AdminStatsDataProps {
  onOpenModal: () => void;
}

interface ActivityColumnProps {
  title: string;
  titleClassName: string;
  children: ReactNode;
}

interface RecentActivityCardProps extends AdminStatsDataProps {
  onOpenModal: () => void;
}

interface AdminStatsContentProps extends AdminStatsDataProps {
  error: string;
  onOpenCreators: () => void;
  onOpenActivity: () => void;
}

interface AdminStatsModalsProps {
  activeModal: StatsModalType;
  onClose: () => void;
  t: TranslateFn;
}

interface AdminStatsState {
  stats: AdminStatsViewModel | null;
  loading: boolean;
  error: string;
  activeModal: StatsModalType;
}

type AdminStatsAction =
  | { type: 'startFetch' }
  | { type: 'fetchSuccess'; stats: AdminStatsViewModel }
  | { type: 'fetchError'; message: string }
  | { type: 'openModal'; modal: Exclude<StatsModalType, null> }
  | { type: 'closeModal' };

const initialState: AdminStatsState = {
  stats: null,
  loading: true,
  error: '',
  activeModal: null,
};

function adminStatsReducer(state: AdminStatsState, action: AdminStatsAction): AdminStatsState {
  switch (action.type) {
    case 'startFetch':
      return { ...state, loading: true, error: '' };
    case 'fetchSuccess':
      return { ...state, stats: action.stats, loading: false, error: '' };
    case 'fetchError':
      return { ...state, loading: false, error: action.message };
    case 'openModal':
      return { ...state, activeModal: action.modal };
    case 'closeModal':
      return { ...state, activeModal: null };
    default:
      return state;
  }
}

function AdminStatsLayout({ children }: AdminStatsLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}

function AdminStatsErrorBanner({ error }: AdminStatsErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  );
}

function MetricComparison({
  comparison,
  t,
}: {
  comparison: AdminMetricComparisonViewModel;
  t: TranslateFn;
}) {
  const value =
    comparison.changePercent === null
      ? t('trendNew')
      : `${comparison.changePercent > 0 ? '+' : ''}${comparison.changePercent}%`;

  return (
    <p
      className={`mt-2 text-xs font-medium ${
        comparison.changePercent !== null && comparison.changePercent < 0
          ? 'text-error'
          : 'text-brand-trust'
      }`}
    >
      {value} {t('vsPreviousPeriod')}
    </p>
  );
}

function OverviewCards({ stats, t }: AdminStatsDataProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600">
            {t('totalUsersCount')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-brand-trust">{stats.overview.totalUsers}</div>
          <p className="text-xs text-neutral-500">
            {t('newThisMonth', { count: stats.timeBasedStats.thisMonth.newUsers })}
          </p>
          <MetricComparison comparison={stats.growthTrends.comparison.newUsers} t={t} />
          <div className="mt-2">
            <KpiSparkline
              data={stats.growthTrends.data.slice(-7).map((point) => point.newUsers)}
              color="var(--blue-500)"
              label={t('sparklineLabel', { title: t('totalUsersCount') })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600">
            {t('totalQuizzes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.overview.totalQuizzes}</div>
          <p className="text-xs text-neutral-500">{t('availableQuizzes')}</p>
          <MetricComparison comparison={stats.growthTrends.comparison.newQuizzes} t={t} />
          <div className="mt-2">
            <KpiSparkline
              data={stats.growthTrends.data.slice(-7).map((point) => point.newQuizzes)}
              color="var(--green-500)"
              label={t('sparklineLabel', { title: t('totalQuizzes') })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600">
            {t('attemptsCount')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-brand-action">{stats.overview.totalAttempts}</div>
          <p className="text-xs text-neutral-500">
            {t('attempts', { count: stats.timeBasedStats.thisMonth.attempts })}
          </p>
          <MetricComparison comparison={stats.growthTrends.comparison.attempts} t={t} />
          <div className="mt-2">
            <KpiSparkline
              data={stats.growthTrends.data.slice(-7).map((point) => point.attempts)}
              color="var(--orange-500)"
              label={t('sparklineLabel', { title: t('attemptsCount') })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600">
            {t('averageScore')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-brand-trust">
            {Math.round(stats.scoreStats.averageScore)}%
          </div>
          <p className="text-xs text-neutral-500">
            {t('highestScore', { score: stats.scoreStats.highestScore })}
          </p>
          <MetricComparison comparison={stats.growthTrends.comparison.averageScore} t={t} />
          <div className="mt-2">
            <KpiSparkline
              data={stats.growthTrends.data.slice(-7).map((point) => point.averageScore)}
              color="var(--purple-500)"
              label={t('sparklineLabel', { title: t('averageScore') })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GrowthTrendsSection({
  initialData,
  t,
}: {
  initialData: AdminGrowthTrendsViewModel;
  t: TranslateFn;
}) {
  const [period, setPeriod] = useState<AdminGrowthPeriodViewModel>(initialData.period);
  const [growthData, setGrowthData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const selectPeriod = async (nextPeriod: AdminGrowthPeriodViewModel) => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    setLoading(true);
    try {
      const data = await fetchGrowthTrendsViewModel(nextPeriod);
      setGrowthData(data);
    } catch {
      setGrowthData({ ...initialData, period: nextPeriod, data: [] });
    } finally {
      setLoading(false);
    }
  };

  const periods: { value: AdminGrowthPeriodViewModel; label: string }[] = [
    { value: 7, label: t('period7d') },
    { value: 30, label: t('period30d') },
    { value: 90, label: t('period90d') },
    { value: 365, label: t('period1y') },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('growthTrends')}</CardTitle>
          <CardDescription>{t('growthTrendsDescription')}</CardDescription>
        </div>
        <div className="flex gap-1">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => void selectPeriod(p.value)}
              className="min-h-11 px-3 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <GrowthTrendChart
          data={growthData.data}
          isLoading={loading}
          labels={{
            chart: t('growthChartLabel'),
            loading: t('chartLoading'),
            empty: t('noChartData'),
            users: t('users'),
            quizzes: t('quizzes'),
            attempts: t('attemptsCount'),
          }}
        />
      </CardContent>
    </Card>
  );
}

function ScoreDistributionSection({ stats, t }: AdminStatsDataProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('scoreDistribution')}</CardTitle>
          <CardDescription>{t('scoreDistributionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreDistributionChart
            data={stats.scoreStats.scoreDistribution}
            label={t('scoreDistribution')}
            emptyLabel={t('noChartData')}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('averageScore')}</CardTitle>
          <CardDescription>{t('medianNote')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-brand-trust">
                {Math.round(stats.scoreStats.averageScore)}%
              </div>
              <p className="mt-1 text-sm text-neutral-500">{t('averageScore')}</p>
            </div>
            <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">
                  {t('highestScore', { score: '' }).replace(': %', '')}
                </span>
                <span className="font-semibold text-green-600">
                  {stats.scoreStats.highestScore}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">
                  {t('lowestScore', { score: '' }).replace(': %', '')}
                </span>
                <span className="font-semibold text-red-500">{stats.scoreStats.lowestScore}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{t('passRate')}</span>
                <span className="font-semibold text-brand-trust">
                  {stats.scoreStats.scoreDistribution.length > 0
                    ? `${stats.scoreStats.passRate}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TopCreatorsSection({ stats, t, onOpenModal }: TopCreatorsSectionProps) {
  const creatorData = stats.topCreators.slice(0, 10).map((creator) => ({
    email: creator.email,
    quizCount: creator.quizCount,
    totalQuestions: creator.totalQuestions,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('topCreators')}</CardTitle>
          <CardDescription>{t('mostQuizzesCreated')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenModal} className="min-h-[36px] px-3">
          {t('viewAll')}
        </Button>
      </CardHeader>
      <CardContent>
        <TopCreatorsBarChart
          data={creatorData}
          label={t('topCreators')}
          emptyLabel={t('noChartData')}
          quizzesLabel={t('quizzes')}
          questionsLabel={t('questions')}
        />
      </CardContent>
    </Card>
  );
}

function ActivityColumn({ title, titleClassName, children }: ActivityColumnProps) {
  return (
    <div>
      <h4 className={`mb-3 font-medium ${titleClassName}`}>{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RecentActivityCard({ stats, t, onOpenModal }: RecentActivityCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('recentActivity')}</CardTitle>
          <CardDescription>{t('last30Days')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenModal} className="min-h-[36px] px-3">
          {t('viewAll')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ActivityColumn title={t('newUsers', { count: '' })} titleClassName="text-brand-trust">
            {stats.recentActivity.users.slice(0, 5).map((user) => (
              <div key={user.email} className="rounded bg-green-50 p-2 text-sm">
                <div className="font-medium">{user.email}</div>
                <div className="text-neutral-500">{user.createdAtLabel}</div>
              </div>
            ))}
          </ActivityColumn>

          <ActivityColumn title={t('newQuizzes', { count: '' })} titleClassName="text-green-600">
            {stats.recentActivity.quizzes.slice(0, 5).map((quiz) => (
              <div key={quiz.title} className="rounded bg-green-50 p-2 text-sm">
                <div className="truncate font-medium">{quiz.title}</div>
                <div className="text-xs text-neutral-500">{quiz.createdAtLabel}</div>
              </div>
            ))}
          </ActivityColumn>

          <ActivityColumn title={t('recentAttempts')} titleClassName="text-brand-trust">
            {stats.recentActivity.attempts.slice(0, 5).map((attempt) => (
              <div key={attempt.id} className="rounded bg-green-50 p-2 text-sm">
                <div className="truncate font-medium">{attempt.quiz.title}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{attempt.actor.email}</span>
                  <span className="font-medium">{attempt.score}%</span>
                </div>
                <div className="text-xs text-neutral-500">{attempt.takenAtLabel}</div>
              </div>
            ))}
          </ActivityColumn>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminStatsContent({
  stats,
  error,
  t,
  onOpenCreators,
  onOpenActivity,
}: AdminStatsContentProps) {
  return (
    <>
      <AdminPageHeader title={t('statistics')} description={t('systemStatistics')} />
      <AdminStatsErrorBanner error={error} />
      <div className="space-y-6">
        <OverviewCards stats={stats} t={t} />
        <GrowthTrendsSection initialData={stats.growthTrends} t={t} />
        <ScoreDistributionSection stats={stats} t={t} />
        <TopCreatorsSection stats={stats} t={t} onOpenModal={onOpenCreators} />
        <RecentActivityCard stats={stats} t={t} onOpenModal={onOpenActivity} />
        <LlmUsageSection />
        <EntitlementTelemetrySection />
      </div>
    </>
  );
}

function AdminStatsModals({ activeModal, onClose, t }: AdminStatsModalsProps) {
  return (
    <>
      <StatsModal
        isOpen={activeModal === 'creators'}
        onClose={onClose}
        title={t('allCreators')}
        type="creators"
        apiEndpoint="/api/admin/stats/creators"
      />
      <StatsModal
        isOpen={activeModal === 'activity'}
        onClose={onClose}
        title={t('allRecentActivity')}
        type="activity"
        apiEndpoint="/api/admin/stats/activity?type=mixed"
      />
    </>
  );
}

export default function AdminStatsPage() {
  const t = useTranslations('admin');
  const [state, dispatch] = useReducer(adminStatsReducer, initialState);

  useEffect(() => {
    const fetchStats = async () => {
      dispatch({ type: 'startFetch' });

      try {
        const data = await fetchAdminStatsViewModel();
        dispatch({ type: 'fetchSuccess', stats: data });
      } catch (error) {
        dispatch({
          type: 'fetchError',
          message: error instanceof Error ? error.message : 'Failed to fetch statistics',
        });
      }
    };

    void fetchStats();
  }, []);

  if (state.loading) {
    return (
      <AdminStatsLayout>
        <AdminStatsPageSkeleton />
      </AdminStatsLayout>
    );
  }

  return (
    <AdminStatsLayout>
      {state.stats ? (
        <AdminStatsContent
          stats={state.stats}
          error={state.error}
          t={t}
          onOpenCreators={() => dispatch({ type: 'openModal', modal: 'creators' })}
          onOpenActivity={() => dispatch({ type: 'openModal', modal: 'activity' })}
        />
      ) : (
        <>
          <AdminPageHeader title={t('statistics')} description={t('systemStatistics')} />
          <AdminStatsErrorBanner error={state.error} />
        </>
      )}

      <AdminStatsModals
        activeModal={state.activeModal}
        onClose={() => dispatch({ type: 'closeModal' })}
        t={t}
      />
    </AdminStatsLayout>
  );
}
