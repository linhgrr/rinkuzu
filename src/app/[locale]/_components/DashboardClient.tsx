'use client';

import { useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/shared/StatCard';
import { QuizCard } from '@/components/shared/QuizCard';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { LevelBadge } from '@/components/dashboard/LevelBadge';
import { WeeklyProgressHeatmap } from '@/components/dashboard/WeeklyProgressHeatmap';
import type { UserStats } from '@/hooks/useStats';
import type { Quiz } from '@/hooks/useQuizzes';
import { ROUTES } from '@/shared/constants';
import { fetcher } from '@/lib/fetcher';
import {
  HiOutlineFire,
  HiOutlineLightningBolt,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineTrendingUp,
  HiOutlineLightBulb,
} from '@/components/icons';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { FiBookOpen, FiTarget, FiZap, FiAward } from 'react-icons/fi';

const StatCardsSkeleton = memo(function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card
          key={`stats-skeleton-${index}`}
          className="p-5 rounded-2xl shadow-sm border-gray-100/50"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl skeleton-shimmer shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3 w-16 skeleton-shimmer" />
              <div className="h-7 w-20 skeleton-shimmer" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
});

const QuizCardsSkeleton = memo(function QuizCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <Card
          key={`quiz-skeleton-${index}`}
          className="rounded-2xl shadow-sm border-gray-100/50 p-5 min-h-[160px]"
          aria-hidden="true"
        >
          <div className="space-y-3">
            <div className="h-5 w-24 skeleton-shimmer rounded-full" />
            <div className="h-5 w-4/5 skeleton-shimmer" />
            <div className="h-5 w-2/3 skeleton-shimmer" />
            <div className="h-px bg-gray-100 my-3" />
            <div className="flex justify-between">
              <div className="h-4 w-16 skeleton-shimmer" />
              <div className="h-4 w-14 skeleton-shimmer" />
            </div>
          </div>
        </Card>
      ))}
    </>
  );
});

const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <>
      <Card className="p-6 border-0 shadow-lg shadow-gray-100/50 bg-white rounded-2xl" aria-hidden="true">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-[120px] h-[100px] skeleton-shimmer rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-24 skeleton-shimmer" />
            <div className="h-4 w-28 skeleton-shimmer" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-24 skeleton-shimmer" />
            <div className="h-4 w-16 skeleton-shimmer" />
          </div>
          <div className="h-3 w-full skeleton-shimmer rounded-full" />
          <div className="h-3 w-32 skeleton-shimmer mx-auto" />
        </div>
      </Card>

      <Card className="p-6 rounded-2xl shadow-sm border-gray-100/50 bg-white" aria-hidden="true">
        <div className="h-5 w-32 skeleton-shimmer mb-5" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`heatmap-skeleton-${index}`} className="flex flex-col items-center gap-2">
              <div className="h-3 w-3 skeleton-shimmer" />
              <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
            </div>
          ))}
        </div>
        <div className="h-3 w-40 skeleton-shimmer mt-5 mx-auto" />
      </Card>

      <Card className="p-5 border-slate-100 bg-slate-50/30 rounded-2xl shadow-sm" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full skeleton-shimmer" />
            <div className="space-y-2">
              <div className="h-4 w-24 skeleton-shimmer" />
              <div className="h-3 w-28 skeleton-shimmer" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-full skeleton-shimmer" />
        </div>
      </Card>
    </>
  );
});

const ProTipCard = memo(function ProTipCard() {
  const t = useTranslations('dashboard');
  return (
    <Card className="p-6 bg-slate-900 text-white border-0 shadow-xl overflow-hidden relative group">
      <div className="relative z-10">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4 border border-white/10 group-hover:bg-white/20 transition-all">
          <HiOutlineLightBulb className="w-6 h-6 text-slate-100" />
        </div>
        <h3 className="font-bold text-lg mb-2">{t('proTip')}</h3>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed font-medium">
          {t('proTipContent')}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-white/20 text-white hover:bg-white hover:text-black transition-all rounded-xl py-5"
        >
          {t('readGuide')}
        </Button>
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-700" />
    </Card>
  );
});

interface DashboardClientProps {
  userEmail: string;
  initialStats?: UserStats;
  initialQuizzes?: Quiz[];
  initialSession?: any;
}

interface DashboardBootstrapResponse {
  success: boolean;
  data: {
    stats: UserStats;
    quizzes: Quiz[];
  };
}

interface BuyFreezeResponse {
  success: boolean;
  message?: string;
  data?: {
    xp: number;
    streakFreezeCount: number;
  };
}

async function buyFreezeFetcher(url: string) {
  const response = await fetch(url, { method: 'POST' });
  return response.json() as Promise<BuyFreezeResponse>;
}

export function DashboardClient({
  userEmail,
  initialStats,
  initialQuizzes = [],
  initialSession,
}: DashboardClientProps) {
  const t = useTranslations('dashboard');
  const router = useRouter();

  const bootstrapFallbackData =
    initialStats
      ? {
        success: true,
        data: {
          stats: initialStats,
          quizzes: initialQuizzes,
        },
      }
      : undefined;

  const {
    data: bootstrapData,
    isLoading: bootstrapLoading,
    mutate: mutateBootstrapData,
  } = useSWR<DashboardBootstrapResponse>(
    '/api/dashboard/bootstrap',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      fallbackData: bootstrapFallbackData,
    }
  );

  const { trigger: buyFreeze } = useSWRMutation(
    '/api/shop/buy-freeze',
    buyFreezeFetcher,
    {
      onSuccess: (response) => {
        if (response.success && response.data) {
          mutateBootstrapData(
            (currentData) =>
              currentData
                ? {
                  ...currentData,
                  data: {
                    ...currentData.data,
                    stats: {
                      ...currentData.data.stats,
                      xp: response.data!.xp,
                      streakFreezeCount: response.data!.streakFreezeCount,
                    },
                  },
                }
                : currentData,
            { revalidate: false }
          );
        }
      },
    }
  );

  const stats = bootstrapData?.data?.stats;
  const quizzes = bootstrapData?.data?.quizzes ?? [];

  const handleStartReview = useCallback(() => {
    router.push('/review');
  }, [router]);

  const handleCreateQuiz = useCallback(() => {
    router.push(ROUTES.CREATE_QUIZ);
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.push(ROUTES.PENDING_QUIZZES);
  }, [router]);

  const handleExplore = useCallback(() => {
    router.push(ROUTES.EXPLORE);
  }, [router]);

  const handleShare = useCallback(() => {
    const text = `I'm on a ${stats?.streak || 0} day streak learning with RinKuzu! 🚀 Earned ${stats?.xp || 0} XP so far. Level ${stats?.level || 1}!`;
    if (navigator.share) {
      navigator.share({
        title: t('myRinKuzuProgress'),
        text: text,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      toast.success(t('shareProgress'));
    }
  }, [stats?.streak, stats?.xp, stats?.level, t]);

  const handleBuyFreeze = useCallback(async () => {
    try {
      const result = await buyFreeze();
      if (!result?.success) {
        toast.error(result?.message || t('failedToBuyFreeze'));
      }
    } catch (e) {
      console.error(e);
      toast.error(t('failedToConnectServer'));
    }
  }, [buyFreeze, t]);

  const userName = userEmail?.split('@')[0] || 'User';

  const weeklyActivityObj = stats?.weeklyActivity
    ? (typeof stats.weeklyActivity === 'object' ? stats.weeklyActivity : {})
    : {};
  const isStatsInitialLoading = bootstrapLoading && !stats;
  const isQuizzesInitialLoading = bootstrapLoading && quizzes.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans selection:bg-slate-900 selection:text-white">
      <Navigation initialSession={initialSession} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
                  {t('welcome', { name: userName })}
                </h1>
                <p className="text-[#86868b] mt-1 text-lg">
                  {t('keepMomentum')}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleShare}
                className="hidden sm:flex items-center gap-2 rounded-full border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-medium"
              >
                {t('shareProgress')} <HiOutlineShare className="w-4 h-4" />
              </Button>
            </div>

            {/* Hero Section: Adaptive Learning Feature Introduction */}
            <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-200 shadow-sm p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 group transition-all duration-500 hover:shadow-md">
              {/* Subtle background decoration */}
              <div className="pointer-events-none absolute top-0 right-0 w-[40rem] h-[40rem] -mr-40 -mt-40 bg-slate-100/50 rounded-full blur-3xl transition-all duration-700 group-hover:bg-slate-200/50" />

              <div className="relative z-10 flex-1 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 mb-6 uppercase tracking-wider">
                  <FiZap className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('aiPowered', { fallback: 'AI-Powered Engine' })}</span>
                </div>

                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-4">
                  Master any subject with <br />
                  <TextShimmer className="font-extrabold" duration={3}>
                    Adaptive Learning
                  </TextShimmer>
                </h2>

                <p className="text-slate-500 text-base md:text-lg mb-8 leading-relaxed max-w-xl">
                  {t('adaptiveLearningDescription', { fallback: "Upload your documents, and our AI will extract key concepts and relationships, generating a personalized learning path tailored just for you." })}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Button
                    onClick={() => router.push('/adaptive-learning')}
                    className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-8 py-6 font-medium shadow-none transition-all flex items-center justify-center gap-2 text-base"
                  >
                    {t('startLearning', { fallback: "Try Adaptive Learning" })} <HiOutlineArrowRight className="w-5 h-5 ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleStartReview}
                    className="w-full sm:w-auto border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl px-8 py-6 font-medium transition-all text-base bg-white"
                  >
                    {t('startReviewSession', { fallback: "Classic Review" })}
                  </Button>
                </div>
              </div>

              {/* Minimalist Graphic replacing the colored blobs */}
              <div className="relative z-10 hidden lg:flex items-center justify-center w-72 h-72 shrink-0">
                {/* Central node */}
                <div className="w-20 h-20 rounded-3xl bg-white border-2 border-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center z-20">
                  <FiBookOpen className="w-8 h-8 text-slate-900" />
                </div>

                {/* Orbiting structure */}
                <div className="absolute inset-4 rounded-full border-[1.5px] border-dashed border-slate-200 animate-[spin_20s_linear_infinite]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center -rotate-90">
                    <FiTarget className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
                <div className="absolute inset-16 rounded-full border border-slate-200 animate-[spin_15s_linear_infinite_reverse]">
                  <div className="absolute bottom-0 right-1/4 w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                    <FiAward className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-80 z-10 bottom-0 top-1/2" />
              </div>
            </div>

            {/* Quick Stats Grid */}
            {isStatsInitialLoading ? (
              <StatCardsSkeleton />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  label={t('dailyStreak')}
                  value={`${stats?.streak || 0} ${t('days')}`}
                  color="bg-slate-50 text-slate-600"
                  icon={<HiOutlineFire className="text-2xl" />}
                />
                <StatCard
                  label={t('totalXP')}
                  value={stats?.xp || 0}
                  color="bg-slate-900 text-white"
                  icon={<HiOutlineLightningBolt className="text-2xl" />}
                />
                <StatCard
                  label={t('accuracy')}
                  value={`${stats?.averageAccuracy || 0}%`}
                  color="bg-slate-50 text-slate-900 font-bold"
                  icon={<HiOutlineTrendingUp className="text-2xl" />}
                />
                <StatCard
                  label={t('toReview')}
                  value={stats?.dueCount || 0}
                  color="bg-slate-100 text-slate-500"
                  icon={<HiOutlineLightBulb className="text-2xl" />}
                />
              </div>
            )}

            {/* Continue Learning Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1d1d1f]">{t('continueLearning')}</h2>
                <Button
                  variant="ghost"
                  onClick={handleViewAll}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                >
                  {t('viewAllQuizzes')}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div
                  onClick={handleCreateQuiz}
                  className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center hover:border-slate-900 hover:bg-white transition-all duration-300 min-h-[160px] bg-slate-50/50"
                >
                  <div className="w-14 h-14 bg-white border border-slate-200 text-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                    <HiOutlinePlus className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-black">{t('createNewQuiz')}</h3>
                  <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-tight">{t('addYourQuestions')}</p>
                </div>

                {isQuizzesInitialLoading ? (
                  <QuizCardsSkeleton />
                ) : (
                  quizzes.slice(0, 3).map((quiz) => (
                    <QuizCard key={quiz._id} quiz={quiz} />
                  ))
                )}

                {/* Explore Banner as standard card size */}
                <div
                  onClick={handleExplore}
                  className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 text-slate-900 cursor-pointer hover:shadow-md transition-all group min-h-[160px] flex flex-col justify-center"
                >
                  <div className="relative z-10">
                    <div className="inline-flex px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest mb-2">Explore</div>
                    <h3 className="text-lg font-bold mb-1 tracking-tight">{t('exploreCommunity')}</h3>
                    <p className="text-slate-400 text-xs font-medium mb-4">{t('discoverQuizzes')}</p>
                    <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform shadow-sm">
                      <HiOutlineArrowRight className="w-5 h-5 text-slate-900" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-2xl group-hover:bg-slate-100 transition-all" />
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-6 sticky top-24 self-start h-fit">
            {isStatsInitialLoading ? (
              <SidebarSkeleton />
            ) : (
              <>
                {/* Profile Level Card */}
                {stats && (
                  <Card className="p-6 border-0 shadow-lg shadow-gray-100/50 bg-white rounded-2xl">
                    <div className="flex items-center gap-4 mb-4">
                      <LevelBadge level={stats.level} className="shrink-0" />
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{t('level')} {stats.level}</h3>
                        <p className="text-sm text-gray-500">{t('keepLearning')}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-600">{t('levelProgress')}</span>
                        <span className="text-blue-600">{stats.levelProgress}/100 XP</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-slate-900 h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${stats.levelProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        {t('xpNeeded', { xp: 100 - stats.levelProgress, level: stats.level + 1 })}
                      </p>
                    </div>
                  </Card>
                )}

                <WeeklyProgressHeatmap weeklyActivity={weeklyActivityObj} />

                {stats && (
                  <StreakFreezeCard
                    count={stats.streakFreezeCount || 0}
                    xp={stats.xp}
                    onBuy={handleBuyFreeze}
                  />
                )}
              </>
            )}

            <ProTipCard />
          </div>
        </div>
      </main>
    </div>
  );
}
