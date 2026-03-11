'use client';

import { useCallback, memo, Suspense, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/components/shared/QuizCard';
import { StatOverview } from '@/components/dashboard/StatOverview';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { LevelBadge } from '@/components/dashboard/LevelBadge';
import { WeeklyProgressHeatmap } from '@/components/dashboard/WeeklyProgressHeatmap';
import type { UserStats } from '@/hooks/useStats';
import type { Quiz } from '@/hooks/useQuizzes';
import { ROUTES } from '@/shared/constants';
import { fetcher } from '@/lib/fetcher';
import {
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineLightBulb,
} from '@/components/icons';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { FiBookOpen, FiTarget, FiZap, FiAward } from 'react-icons/fi';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

import dynamic from 'next/dynamic';
import { StatCardsSkeleton, QuizCardsSkeleton, SidebarSkeleton } from './DashboardSkeletons';
import { ProTipCard } from './DashboardProTip';

const MascotModel = dynamic(
  () => import('./MascotModel'),
  {
    ssr: false,
  }
);
useGLTF.preload('/models/base_basic_pbr.glb');

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
      fallbackData: bootstrapFallbackData,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
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
  const isStatsInitialLoading = !stats && bootstrapLoading;
  const isQuizzesInitialLoading = quizzes.length === 0 && bootstrapLoading;

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
                className="hidden sm:flex items-center gap-2 rounded-full border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 font-medium min-h-[44px]"
              >
                {t('shareProgress')} <HiOutlineShare className="w-4 h-4" />
              </Button>
            </div>

            {/* Hero Section: Adaptive Learning Feature Introduction */}
            <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-200 shadow-sm p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 group transition-all duration-500 hover:shadow-md">
              {/* Subtle background decoration */}
              <div className="pointer-events-none absolute top-0 right-0 w-[40rem] h-[40rem] -mr-40 -mt-40 bg-teal-50/50 rounded-full blur-3xl transition-all duration-500 group-hover:bg-teal-100/50" />

              <div className="relative z-10 flex-1 max-w-2xl">

                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-4">
                  {t('masterAnySubject')} <br />
                  <TextShimmer className="font-semibold" duration={8}>
                    ✨ {t('aiPowered')}
                  </TextShimmer>
                </h2>

                <p className="text-slate-600 text-base md:text-lg mb-8 leading-relaxed max-w-xl">
                  {t('adaptiveLearningDescription', { fallback: "Upload your documents, and our AI will extract key concepts and relationships, generating a personalized learning path tailored just for you." })}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Button
                    onClick={() => router.push('/adaptive-learning')}
                    className="w-full sm:w-auto bg-teal-600 text-white hover:bg-teal-700 rounded-2xl px-8 py-6 font-medium shadow-lg hover:shadow-teal-500/25 border border-teal-500 transition-all duration-300 flex items-center justify-center gap-2 text-base min-h-[56px]"
                  >
                    {t('startLearning', { fallback: "Try Adaptive Learning" })} <HiOutlineArrowRight className="w-5 h-5 ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleStartReview}
                    className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl px-8 py-6 font-medium transition-all duration-300 text-base bg-white/80 backdrop-blur-md min-h-[56px]"
                  >
                    {t('startReviewSession', { fallback: "Classic Review" })}
                  </Button>
                </div>
              </div>

              {/* Interactive 3D Mascot replacing the static graphic */}
              <div className="relative z-10 hidden lg:flex items-center justify-center w-72 h-72 shrink-0">
                <div className="absolute inset-0 bg-teal-50/50 rounded-full blur-3xl" />
                <div className="w-full h-full relative z-20 cursor-grab active:cursor-grabbing">
                  <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="w-full h-full" dpr={[1, 2]}>
                    <ambientLight intensity={0.8} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <directionalLight position={[-10, 10, -5]} intensity={0.5} />
                    <Environment preset="city" />
                    <Suspense fallback={null}>
                      <MascotModel />
                    </Suspense>
                    <OrbitControls
                      enableZoom={false}
                      enablePan={false}
                      enableRotate={false}
                    />
                  </Canvas>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            {isStatsInitialLoading ? (
              <StatCardsSkeleton />
            ) : (
              <StatOverview stats={stats} />
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
                  className="group cursor-pointer rounded-2xl border-2 border-dashed border-teal-200 p-6 flex flex-col items-center justify-center text-center hover:border-teal-500 hover:bg-teal-50/50 transition-all duration-300 min-h-[160px] bg-slate-50/50"
                >
                  <div className="w-14 h-14 bg-white border border-slate-200 text-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                    <HiOutlinePlus className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-black">{t('createNewQuiz')}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-tight">{t('addYourQuestions')}</p>
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
                  className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200 p-6 text-slate-900 cursor-pointer hover:border-teal-500 hover:shadow-lg hover:shadow-teal-100 transition-all duration-300 group min-h-[160px] flex flex-col justify-center"
                >
                  <div className="relative z-10">
                    <div className="inline-flex px-2 py-0.5 rounded bg-teal-100 text-teal-700 text-[10px] font-bold uppercase tracking-widest mb-2">{t('explore')}</div>
                    <h3 className="text-lg font-bold mb-1 tracking-tight">{t('exploreCommunity')}</h3>
                    <p className="text-slate-500 text-xs font-medium mb-4">{t('discoverQuizzes')}</p>
                    <div className="w-10 h-10 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center group-hover:translate-x-1 group-hover:bg-teal-500 group-hover:text-white transition-all duration-300 shadow-sm">
                      <HiOutlineArrowRight className="w-5 h-5 text-teal-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-teal-50/50 rounded-full blur-2xl group-hover:bg-teal-100/50 transition-all duration-300" />
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
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${stats.levelProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 text-center mt-2">
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
