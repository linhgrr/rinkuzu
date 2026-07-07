'use client';

import { useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { fetchAdminStatsViewModel } from '@/features/admin/stats/api/admin-stats-api';
import type { AdminStatsViewModel } from '@/features/admin/stats/types/admin-stats-view-model';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatsPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import StatsModal from '@/features/admin/stats/components/StatsModal';
import { LlmUsageSection } from '@/features/admin/stats/components/LlmUsageSection';

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

interface TimePeriodCardProps {
  title: string;
  users: number;
  quizzes: number;
  attempts: number;
  titleClassName: string;
  itemClassName: string;
  t: TranslateFn;
}

interface RankingListCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  onViewAll: () => void;
  children: ReactNode;
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
      <div className="p-8">{children}</div>
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
        </CardContent>
      </Card>
    </div>
  );
}

function TimePeriodCard({
  title,
  users,
  quizzes,
  attempts,
  titleClassName,
  itemClassName,
  t,
}: TimePeriodCardProps) {
  return (
    <div className="rounded-lg bg-green-50 p-4 text-center">
      <h3 className={`mb-2 font-medium ${titleClassName}`}>{title}</h3>
      <div className="space-y-1">
        <p className={`text-sm ${itemClassName}`}>{t('newUsers', { count: users })}</p>
        <p className={`text-sm ${itemClassName}`}>{t('newQuizzes', { count: quizzes })}</p>
        <p className={`text-sm ${itemClassName}`}>{t('attempts', { count: attempts })}</p>
      </div>
    </div>
  );
}

function TimeBasedStatsCard({ stats, t }: AdminStatsDataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('activityOverTime')}</CardTitle>
        <CardDescription>{t('systemActivityStats')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <TimePeriodCard
            title={t('today')}
            users={stats.timeBasedStats.today.newUsers}
            quizzes={stats.timeBasedStats.today.newQuizzes}
            attempts={stats.timeBasedStats.today.attempts}
            titleClassName="text-green-800"
            itemClassName="text-brand-trust"
            t={t}
          />
          <TimePeriodCard
            title={t('thisWeek')}
            users={stats.timeBasedStats.thisWeek.newUsers}
            quizzes={stats.timeBasedStats.thisWeek.newQuizzes}
            attempts={stats.timeBasedStats.thisWeek.attempts}
            titleClassName="text-green-900"
            itemClassName="text-green-700"
            t={t}
          />
          <TimePeriodCard
            title={t('thisMonth')}
            users={stats.timeBasedStats.thisMonth.newUsers}
            quizzes={stats.timeBasedStats.thisMonth.newQuizzes}
            attempts={stats.timeBasedStats.thisMonth.attempts}
            titleClassName="text-brand-trust"
            itemClassName="text-green-700"
            t={t}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RankingListCard({
  title,
  description,
  buttonLabel,
  onViewAll,
  children,
}: RankingListCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onViewAll} className="min-h-[36px] px-3">
          {buttonLabel}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function TopCreatorsSection({ stats, t, onOpenModal }: TopCreatorsSectionProps) {
  return (
    <RankingListCard
      title={t('topCreators')}
      description={t('mostQuizzesCreated')}
      buttonLabel={t('viewAll')}
      onViewAll={onOpenModal}
    >
      {stats.topCreators.slice(0, 5).map((creator, index) => (
        <div
          key={creator.email}
          className="flex items-center justify-between rounded-lg bg-neutral-50 p-3"
        >
          <div className="flex items-center gap-x-3">
            <span className="text-sm font-medium text-neutral-500">#{index + 1}</span>
            <span className="font-medium">{creator.email}</span>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">
              {creator.quizCount} {t('quiz')}
            </div>
            <div className="text-neutral-500">
              {creator.totalQuestions} {t('questions')}
            </div>
          </div>
        </div>
      ))}
    </RankingListCard>
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
      <div className="space-y-8">
        <OverviewCards stats={stats} t={t} />
        <TimeBasedStatsCard stats={stats} t={t} />
        <TopCreatorsSection stats={stats} t={t} onOpenModal={onOpenCreators} />
        <RecentActivityCard stats={stats} t={t} onOpenModal={onOpenActivity} />
        <LlmUsageSection />
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
