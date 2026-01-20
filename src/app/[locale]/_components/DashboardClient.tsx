'use client';

import { useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/shared/StatCard';
import { QuizCard } from '@/components/shared/QuizCard';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { LevelBadge } from '@/components/dashboard/LevelBadge';
import { WeeklyProgressHeatmap } from '@/components/dashboard/WeeklyProgressHeatmap';
import { useStats, useQuizzes } from '@/hooks';
import { ROUTES } from '@/shared/constants';
import {
  HiOutlineFire,
  HiOutlineLightningBolt,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineTrendingUp,
  HiOutlineLightBulb,
} from '@/components/icons';

const ProTipCard = memo(function ProTipCard() {
  const t = useTranslations('dashboard');
  return (
    <Card className="p-6 bg-gray-900 text-white border-0 shadow-xl overflow-hidden relative">
      <div className="relative z-10">
        <h3 className="font-bold text-lg mb-2">{t('proTip')}</h3>
        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
          {t('proTipContent')}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-gray-700 text-white hover:bg-white hover:text-black transition-all rounded-full"
        >
          {t('readGuide')}
        </Button>
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl" />
    </Card>
  );
});

export function DashboardClient({ userEmail }: { userEmail: string }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { stats, buyFreeze } = useStats();
  const { quizzes } = useQuizzes();

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

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-12">
      <Navigation />

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

            {/* Hero Section: Modes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Daily Review (Existing) */}
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0071e3] to-[#40a9ff] p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-500 group flex flex-col justify-between min-h-[300px]">
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium mb-4">
                    <HiOutlineFire className="w-4 h-4 text-orange-300" />
                    <span>{t('dailyGoal')}</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2 tracking-tight">
                    {t('questionsDue', { count: stats?.dueCount || 0 })}
                  </h2>
                  <p className="text-blue-50 text-sm mb-6 leading-relaxed opacity-90">
                    {t('reviewingHelps')}
                  </p>
                </div>

                <div className="relative z-10 mt-auto">
                  <Button
                    onClick={handleStartReview}
                    size="lg"
                    className="w-full bg-white text-[#0071e3] hover:bg-blue-50 border-0 rounded-xl py-6 text-base font-semibold shadow-lg hover:translate-y-[-2px] transition-all"
                  >
                    {t('startReviewSession')} <HiOutlineArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                <div className="absolute bottom-[-10%] right-[10%] w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl" />
              </div>

              {/* Card 2: Adaptive Learning (New) */}
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-500 group flex flex-col justify-between min-h-[300px]">
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium mb-4">
                    <svg className="w-4 h-4 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{t('aiPowered')}</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2 tracking-tight">
                    {t('adaptiveLearning')}
                  </h2>
                  <p className="text-indigo-100 text-sm mb-6 leading-relaxed opacity-90">
                    {t('adaptiveLearningDescription')}
                  </p>
                </div>

                <div className="relative z-10 mt-auto">
                  <Button
                    onClick={() => router.push('/adaptive-learning')}
                    size="lg"
                    className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-0 rounded-xl py-6 text-base font-semibold shadow-lg hover:translate-y-[-2px] transition-all"
                  >
                    {t('startLearning')} <HiOutlineArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-purple-500/30 rounded-full blur-2xl" />
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label={t('dailyStreak')}
                value={`${stats?.streak || 0} ${t('days')}`}
                color="bg-orange-50 text-orange-600"
                icon={<HiOutlineFire className="text-2xl" />}
              />
              <StatCard
                label={t('totalXP')}
                value={stats?.xp || 0}
                color="bg-purple-50 text-purple-600"
                icon={<HiOutlineLightningBolt className="text-2xl" />}
              />
              <StatCard
                label={t('accuracy')}
                value={`${stats?.averageAccuracy || 0}%`}
                color="bg-green-50 text-green-600"
                icon={<HiOutlineTrendingUp className="text-2xl" />}
              />
              <StatCard
                label={t('toReview')}
                value={stats?.dueCount || 0}
                color="bg-blue-50 text-blue-600"
                icon={<HiOutlineLightBulb className="text-2xl" />}
              />
            </div>

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
                  className="group cursor-pointer rounded-2xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 min-h-[160px]"
                >
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <HiOutlinePlus className="w-7 h-7" />
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">{t('createNewQuiz')}</h3>
                  <p className="text-sm text-gray-500 mt-1">{t('addYourQuestions')}</p>
                </div>

                {quizzes.slice(0, 3).map((quiz) => (
                  <QuizCard key={quiz._id} quiz={quiz} />
                ))}

                {/* Explore Banner as standard card size */}
                <div
                  onClick={handleExplore}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white cursor-pointer hover:shadow-lg transition-all group min-h-[160px] flex flex-col justify-center"
                >
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold mb-1">{t('exploreCommunity')}</h3>
                    <p className="text-indigo-100 text-sm mb-4">{t('discoverQuizzes')}</p>
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <HiOutlineArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-6 sticky top-24 self-start h-fit">
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
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500"
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

            <ProTipCard />
          </div>
        </div>
      </main>
    </div>
  );
}
