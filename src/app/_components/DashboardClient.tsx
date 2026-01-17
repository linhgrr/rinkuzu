'use client';

import { useCallback, memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/shared/StatCard';
import { QuizCard } from '@/components/shared/QuizCard';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { useStats, useQuizzes } from '@/hooks';
import { ROUTES } from '@/shared/constants';
import {
  HiOutlineFire,
  HiOutlineLightningBolt,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineLightBulb,
} from '@/components/icons';

interface DashboardClientProps {
  userEmail: string;
}

type WeeklyActivityMap = Record<
  string,
  {
    questionsReviewed: number;
    xpEarned: number;
    accuracy: number;
  }
>;

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const WeeklyProgress = memo(function WeeklyProgress({
  activity,
}: {
  activity?: WeeklyActivityMap;
}) {
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayIndex = today.getDay();
    const mondayOffset = (dayIndex + 6) % 7;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);

    return WEEKDAY_LABELS.map((label, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      const key = date.toISOString().split('T')[0];
      const entry = activity?.[key];
      return {
        label,
        key,
        date,
        entry,
        isToday: key === today.toISOString().split('T')[0],
      };
    });
  }, [activity]);

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Weekly Progress</h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => {
          const hasActivity = (day.entry?.questionsReviewed ?? 0) > 0;
          const tooltip = day.entry
            ? `${day.entry.questionsReviewed} reviews • ${day.entry.xpEarned} XP`
            : 'No activity yet';
          return (
            <div key={day.key} className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#86868b]">{day.label}</span>
              <div
                title={tooltip}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  hasActivity
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                } ${day.isToday ? 'ring-2 ring-blue-200' : ''}`}
              >
                {hasActivity ? '✓' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

const ProTipCard = memo(function ProTipCard() {
  return (
    <Card className="p-6 bg-gray-900 text-white">
      <h3 className="font-semibold mb-2">Pro Tip</h3>
      <p className="text-sm text-gray-300 mb-4">
        Reviewing your cards daily helps move them to long-term memory via
        Spaced Repetition.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-gray-700 text-white hover:bg-gray-800"
      >
        Read Guide
      </Button>
    </Card>
  );
});

export function DashboardClient({ userEmail }: DashboardClientProps) {
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
    const text = `I'm on a ${stats?.streak || 0} day streak learning with RinKuzu! 🚀 Earned ${stats?.xp || 0} XP so far.`;
    if (navigator.share) {
      navigator.share({
        title: 'My RinKuzu Progress',
        text: text,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Progress copied to clipboard!');
    }
  }, [stats?.streak, stats?.xp]);

  const handleBuyFreeze = useCallback(async () => {
    try {
      const result = await buyFreeze();
      if (!result?.success) {
        toast.error(result?.message || 'Failed to buy freeze');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to connect to server');
    }
  }, [buyFreeze]);

  const userName = userEmail?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-8">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Welcome Header */}
        <div className="mb-6 md:mb-8 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#1d1d1f]">
                Welcome back, {userName}!{' '}
                <HiOutlineLightBulb className="inline-block text-yellow-500" />
              </h1>
              <p className="text-sm md:text-base text-[#86868b]">
                Here&apos;s what you should focus on today.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleShare}
              size="sm"
              className="hidden sm:flex items-center gap-2"
            >
              Share Progress <HiOutlineShare className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 bg-gradient-to-br from-[#0071e3] to-[#40a9ff] text-white col-span-2 relative overflow-hidden">
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[120px]">
              <div>
                <p className="text-blue-100 font-medium text-sm uppercase tracking-wide">
                  Daily Review
                </p>
                <h2 className="text-3xl font-bold mt-1">
                  {stats?.dueCount || 0} questions due
                </h2>
              </div>
              <Button
                onClick={handleStartReview}
                className="bg-white text-blue-600 hover:bg-blue-50 w-fit mt-4 border-0 flex items-center gap-2"
              >
                Start Review Session <HiOutlineArrowRight />
              </Button>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Card>

          <StatCard
            label="Daily Streak"
            value={`${stats?.streak || 0} days`}
            color="bg-orange-100 text-orange-600"
            icon={<HiOutlineFire className="text-2xl" />}
          />

          <StatCard
            label="Total XP"
            value={stats?.xp || 0}
            color="bg-purple-100 text-purple-600"
            icon={<HiOutlineLightningBolt className="text-2xl" />}
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Continue Learning */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[#1d1d1f]">
                  Continue Learning
                </h2>
                <Button variant="ghost" size="sm" onClick={handleViewAll}>
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create New Card */}
                <Card
                  className="p-6 border-dashed border-2 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors h-full"
                  onClick={handleCreateQuiz}
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                    <HiOutlinePlus className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-blue-900">
                    Create New Quiz
                  </h3>
                </Card>

                {/* Quizzes List */}
                {quizzes.slice(0, 5).map((quiz) => (
                  <QuizCard key={quiz._id} quiz={quiz} />
                ))}
              </div>

              {/* Explore Banner */}
              <Card
                className="mt-5 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white overflow-hidden relative cursor-pointer hover:shadow-lg transition-shadow"
                onClick={handleExplore}
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      Explore More Quizzes
                    </h3>
                    <p className="text-indigo-100 text-sm">
                      Discover thousands of quizzes from the community.
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <HiOutlineArrowRight className="w-6 h-6" />
                  </div>
                </div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              </Card>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <WeeklyProgress activity={stats?.weeklyActivity} />

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
      </div>
    </div>
  );
}
