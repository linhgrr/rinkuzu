# Dashboard Gamification Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all gamification bugs on the dashboard: Level calculation, Weekly Progress with real data + navigation + heat map, Accuracy moving average, display longestStreak, and increment totalReviewSessions.

**Architecture:**

- Add utility functions for level calculation and date helpers
- Update API to calculate level dynamically and track accuracy properly
- Replace static WeeklyProgress component with data-driven heat map with week navigation
- Update Dashboard UI to show longestStreak

**Tech Stack:** Next.js 14, TypeScript, React, TailwindCSS, MongoDB/Mongoose, SWR

---

## Task 1: Add Level Calculation Utility

**Files:**

- Create: `src/lib/gamification.ts`

**Step 1: Create the utility file with level calculation**

```typescript
// src/lib/gamification.ts

/**
 * Calculate user level from XP (Linear: 100 XP = 1 level)
 * Level 1: 0-99 XP
 * Level 2: 100-199 XP
 * etc.
 */
export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

/**
 * Calculate XP needed for next level
 */
export function xpForNextLevel(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const xpForCurrentLevel = (currentLevel - 1) * 100;
  const xpForNext = currentLevel * 100;
  return xpForNext - totalXp;
}

/**
 * Calculate progress percentage to next level (0-100)
 */
export function levelProgress(totalXp: number): number {
  const xpInCurrentLevel = totalXp % 100;
  return xpInCurrentLevel;
}
```

**Step 2: Verify file created**

Run: `cat /home/linh/Downloads/rinkuzu/src/lib/gamification.ts`
Expected: File contents displayed

**Step 3: Commit**

```bash
git add src/lib/gamification.ts
git commit -m "feat: add level calculation utility (100 XP = 1 level)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Date Helper Utilities

**Files:**

- Create: `src/lib/date-utils.ts`

**Step 1: Create date utility functions**

```typescript
// src/lib/date-utils.ts

/**
 * Get start of week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get array of dates for a week (Mon-Sun)
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get short day name (M, T, W, T, F, S, S)
 */
export function getShortDayName(date: Date): string {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return days[date.getDay()];
}

/**
 * Get dates for last N days
 */
export function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(formatDateKey(d));
  }
  return dates;
}
```

**Step 2: Verify file created**

Run: `cat /home/linh/Downloads/rinkuzu/src/lib/date-utils.ts`
Expected: File contents displayed

**Step 3: Commit**

```bash
git add src/lib/date-utils.ts
git commit -m "feat: add date utility functions for weekly progress

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Stats API to Calculate Level Dynamically

**Files:**

- Modify: `src/app/api/progress/stats/route.ts`

**Step 1: Update the API to use level calculation**

Replace the entire file content:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import { authOptions } from '@/lib/auth';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const userId = (session.user as any).id;

    // Get stats
    let uProgress = await UserProgress.findOne({ userId });

    if (!uProgress) {
      // Initialize if null
      uProgress = await UserProgress.create({ userId });
    }

    // Get due count
    const dueCount = await QuestionProgress.countDocuments({
      userId,
      nextReviewDate: { $lte: new Date() },
    });

    // Calculate level dynamically from XP
    const level = calculateLevel(uProgress.totalXp);
    const xpToNextLevel = xpForNextLevel(uProgress.totalXp);
    const currentLevelProgress = levelProgress(uProgress.totalXp);

    return NextResponse.json({
      streak: uProgress.currentStreak,
      longestStreak: uProgress.longestStreak,
      streakFreezeCount: uProgress.streakFreezeCount,
      xp: uProgress.totalXp,
      level: level,
      xpToNextLevel: xpToNextLevel,
      levelProgress: currentLevelProgress,
      dueCount: dueCount,
      weeklyActivity: uProgress.weeklyActivity,
      totalQuestionsLearned: uProgress.totalQuestionsLearned,
      totalReviewSessions: uProgress.totalReviewSessions,
      averageAccuracy: uProgress.averageAccuracy,
    });
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
```

**Step 2: Verify the changes**

Run: `cat /home/linh/Downloads/rinkuzu/src/app/api/progress/stats/route.ts`
Expected: Updated file with calculateLevel import and usage

**Step 3: Commit**

```bash
git add src/app/api/progress/stats/route.ts
git commit -m "fix: calculate level dynamically from XP in stats API

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Review Submit API for Accuracy Tracking

**Files:**

- Modify: `src/app/api/review/submit/route.ts`

**Step 1: Update accuracy calculation to use moving average**

Find and replace the weekly activity update section (around lines 139-163) with proper accuracy tracking:

```typescript
// Weekly Activity Update
if (!uProgress.weeklyActivity) {
  uProgress.weeklyActivity = new Map();
}

const activityKey = todayStr;
const currentActivity = uProgress.weeklyActivity.get(activityKey) || {
  questionsReviewed: 0,
  xpEarned: 0,
  correctCount: 0,
  totalCount: 0,
};

currentActivity.questionsReviewed += 1;
currentActivity.xpEarned += xpGain;
currentActivity.totalCount += 1;
if (['good', 'easy'].includes(rating)) {
  currentActivity.correctCount += 1;
}

uProgress.weeklyActivity.set(activityKey, currentActivity);

// Calculate 7-day moving average accuracy
const last7Days: string[] = [];
for (let i = 6; i >= 0; i--) {
  const d = new Date(now);
  d.setDate(d.getDate() - i);
  last7Days.push(d.toISOString().split('T')[0]);
}

let totalCorrect = 0;
let totalReviews = 0;
for (const dayKey of last7Days) {
  const dayActivity = uProgress.weeklyActivity.get(dayKey);
  if (dayActivity) {
    totalCorrect += dayActivity.correctCount || 0;
    totalReviews += dayActivity.totalCount || 0;
  }
}

uProgress.averageAccuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

// Increment review session count (once per day)
const lastSessionDate = uProgress.lastSessionDate
  ? new Date(uProgress.lastSessionDate).toISOString().split('T')[0]
  : null;
if (lastSessionDate !== todayStr) {
  uProgress.totalReviewSessions += 1;
  uProgress.lastSessionDate = now;
}
```

**Step 2: Verify the changes**

Run: `grep -A 5 "Weekly Activity Update" /home/linh/Downloads/rinkuzu/src/app/api/review/submit/route.ts`
Expected: Updated code with correctCount/totalCount tracking

**Step 3: Commit**

```bash
git add src/app/api/review/submit/route.ts
git commit -m "fix: implement 7-day moving average accuracy and session tracking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update UserProgress Model Schema

**Files:**

- Modify: `src/models/UserProgress.ts`

**Step 1: Update the schema to include new fields**

Replace the entire file:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export interface IUserProgress extends Document {
  userId: string;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;

  // XP & Level (level is calculated, not stored)
  totalXp: number;
  level: number; // Deprecated - calculated dynamically

  // Stats
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  lastSessionDate: Date;
  averageAccuracy: number;

  // Weekly activity
  weeklyActivity: Map<string, IDailyActivity>;
}

const DailyActivitySchema = new Schema(
  {
    questionsReviewed: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Streaks
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },
    streakFreezeCount: { type: Number, default: 0 },

    // XP & Level
    totalXp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }, // Deprecated

    // Stats
    totalQuestionsLearned: { type: Number, default: 0 },
    totalQuizzesTaken: { type: Number, default: 0 },
    totalReviewSessions: { type: Number, default: 0 },
    lastSessionDate: { type: Date, default: null },
    averageAccuracy: { type: Number, default: 0 },

    // Weekly activity
    weeklyActivity: {
      type: Map,
      of: DailyActivitySchema,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.UserProgress ||
  mongoose.model<IUserProgress>('UserProgress', UserProgressSchema);
```

**Step 2: Verify the changes**

Run: `grep -A 3 "correctCount" /home/linh/Downloads/rinkuzu/src/models/UserProgress.ts`
Expected: correctCount and totalCount fields visible

**Step 3: Commit**

```bash
git add src/models/UserProgress.ts
git commit -m "feat: update UserProgress schema with accuracy tracking fields

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Update useStats Hook Interface

**Files:**

- Modify: `src/hooks/useStats.ts`

**Step 1: Update the UserStats interface**

Replace the entire file:

```typescript
'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { fetcher } from '@/lib/fetcher';

interface DailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export interface UserStats {
  streak: number;
  longestStreak: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  streakFreezeCount: number;
  weeklyActivity: Record<string, DailyActivity>;
  totalQuestionsLearned: number;
  totalReviewSessions: number;
  averageAccuracy: number;
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
  const res = await fetch(url, { method: 'POST' });
  return res.json() as Promise<BuyFreezeResponse>;
}

export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<UserStats>('/api/progress/stats', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000, // 30 seconds
  });

  const { trigger: buyFreeze, isMutating: isBuyingFreeze } = useSWRMutation(
    '/api/shop/buy-freeze',
    buyFreezeFetcher,
    {
      onSuccess: (response) => {
        if (response.success && response.data) {
          // Optimistically update the cache
          mutate(
            (current) =>
              current
                ? {
                    ...current,
                    xp: response.data!.xp,
                    streakFreezeCount: response.data!.streakFreezeCount,
                  }
                : current,
            { revalidate: false },
          );
        }
      },
    },
  );

  return {
    stats: data,
    isLoading,
    error,
    buyFreeze,
    isBuyingFreeze,
    mutateStats: mutate,
  };
}
```

**Step 2: Verify the changes**

Run: `grep -A 5 "longestStreak" /home/linh/Downloads/rinkuzu/src/hooks/useStats.ts`
Expected: longestStreak in UserStats interface

**Step 3: Commit**

```bash
git add src/hooks/useStats.ts
git commit -m "feat: update useStats hook with extended stats interface

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Create WeeklyProgressHeatmap Component

**Files:**

- Create: `src/components/dashboard/WeeklyProgressHeatmap.tsx`

**Step 1: Create the heat map component**

```typescript
'use client';

import { memo, useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from '@/components/icons';

interface DailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

interface WeeklyProgressHeatmapProps {
  weeklyActivity: Record<string, DailyActivity>;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getIntensityClass(questions: number): string {
  if (questions === 0) return 'bg-gray-100';
  if (questions <= 5) return 'bg-green-200';
  if (questions <= 10) return 'bg-green-400';
  if (questions <= 20) return 'bg-green-500';
  return 'bg-green-600';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const WeeklyProgressHeatmap = memo(function WeeklyProgressHeatmap({
  weeklyActivity,
}: WeeklyProgressHeatmapProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekDates, weekLabel, isCurrentWeek } = useMemo(() => {
    const today = new Date();
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + weekOffset * 7);

    const weekStart = getWeekStart(baseDate);
    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatShort = (d: Date) =>
      `${d.getDate()}/${d.getMonth() + 1}`;

    return {
      weekDates: dates,
      weekLabel: `${formatShort(weekStart)} - ${formatShort(weekEnd)}`,
      isCurrentWeek: weekOffset === 0,
    };
  }, [weekOffset]);

  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => {
    if (weekOffset < 0) setWeekOffset((prev) => prev + 1);
  };

  const todayKey = formatDateKey(new Date());

  return (
    <Card className="p-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1d1d1f]">Weekly Progress</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Previous week"
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-[#86868b] min-w-[100px] text-center">
            {isCurrentWeek ? 'This week' : weekLabel}
          </span>
          <button
            onClick={handleNextWeek}
            disabled={weekOffset >= 0}
            className={`p-1 rounded-full transition-colors ${
              weekOffset >= 0
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-gray-100'
            }`}
            aria-label="Next week"
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Heat map grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const dateKey = formatDateKey(date);
          const activity = weeklyActivity?.[dateKey];
          const questions = activity?.questionsReviewed || 0;
          const xp = activity?.xpEarned || 0;
          const isToday = dateKey === todayKey;

          return (
            <div key={dateKey} className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#86868b] font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${getIntensityClass(questions)} ${
                  isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                } ${questions > 0 ? 'text-white' : 'text-gray-400'}`}
                title={`${date.toLocaleDateString()}: ${questions} questions, ${xp} XP`}
              >
                {questions > 0 ? questions : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#86868b]">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-gray-100" />
          <div className="w-4 h-4 rounded bg-green-200" />
          <div className="w-4 h-4 rounded bg-green-400" />
          <div className="w-4 h-4 rounded bg-green-500" />
          <div className="w-4 h-4 rounded bg-green-600" />
        </div>
        <span>More</span>
      </div>
    </Card>
  );
});
```

**Step 2: Verify file created**

Run: `head -30 /home/linh/Downloads/rinkuzu/src/components/dashboard/WeeklyProgressHeatmap.tsx`
Expected: Component file with heat map logic

**Step 3: Commit**

```bash
git add src/components/dashboard/WeeklyProgressHeatmap.tsx
git commit -m "feat: add WeeklyProgressHeatmap component with navigation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Add Chevron Icons Export

**Files:**

- Modify: `src/components/icons/index.ts` (or wherever icons are exported)

**Step 1: Check current icons file and add chevron exports**

First check the file location:
Run: `cat /home/linh/Downloads/rinkuzu/src/components/icons/index.ts`

Then add the chevron icons if not present:

```typescript
export { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';
```

**Step 2: Verify the export**

Run: `grep "Chevron" /home/linh/Downloads/rinkuzu/src/components/icons/index.ts`
Expected: ChevronLeft and ChevronRight exports

**Step 3: Commit**

```bash
git add src/components/icons/index.ts
git commit -m "feat: add chevron icon exports for navigation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Update DashboardClient Component

**Files:**

- Modify: `src/app/_components/DashboardClient.tsx`

**Step 1: Replace the entire DashboardClient with updated version**

```typescript
'use client';

import { useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/shared/StatCard';
import { QuizCard } from '@/components/shared/QuizCard';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { WeeklyProgressHeatmap } from '@/components/dashboard/WeeklyProgressHeatmap';
import { useStats, useQuizzes } from '@/hooks';
import { ROUTES } from '@/shared/constants';
import {
  HiOutlineFire,
  HiOutlineLightningBolt,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineLightBulb,
  HiOutlineTrendingUp,
  HiOutlineAcademicCap,
} from '@/components/icons';

interface DashboardClientProps {
  userEmail: string;
}

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
    const text = `I'm on a ${stats?.streak || 0} day streak learning with RinKuzu! 🚀 Earned ${stats?.xp || 0} XP so far. Level ${stats?.level || 1}!`;
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
  }, [stats?.streak, stats?.xp, stats?.level]);

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

  // Convert weeklyActivity Map to object if needed
  const weeklyActivityObj = stats?.weeklyActivity
    ? (typeof stats.weeklyActivity === 'object' ? stats.weeklyActivity : {})
    : {};

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

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Level"
            value={stats?.level || 1}
            color="bg-blue-100 text-blue-600"
            icon={<HiOutlineAcademicCap className="text-2xl" />}
          />

          <StatCard
            label="Best Streak"
            value={`${stats?.longestStreak || 0} days`}
            color="bg-amber-100 text-amber-600"
            icon={<HiOutlineTrendingUp className="text-2xl" />}
          />

          <StatCard
            label="7-Day Accuracy"
            value={`${stats?.averageAccuracy || 0}%`}
            color="bg-green-100 text-green-600"
            icon={<HiOutlineTrendingUp className="text-2xl" />}
          />

          <StatCard
            label="Review Sessions"
            value={stats?.totalReviewSessions || 0}
            color="bg-indigo-100 text-indigo-600"
            icon={<HiOutlineAcademicCap className="text-2xl" />}
          />
        </div>

        {/* Level Progress Bar */}
        {stats && (
          <Card className="p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#1d1d1f]">
                Level {stats.level} Progress
              </span>
              <span className="text-sm text-[#86868b]">
                {stats.levelProgress}/100 XP to Level {stats.level + 1}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.levelProgress}%` }}
              />
            </div>
          </Card>
        )}

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
      </div>
    </div>
  );
}
```

**Step 2: Verify the changes**

Run: `grep "WeeklyProgressHeatmap" /home/linh/Downloads/rinkuzu/src/app/_components/DashboardClient.tsx`
Expected: Import and usage of WeeklyProgressHeatmap

**Step 3: Commit**

```bash
git add src/app/_components/DashboardClient.tsx
git commit -m "feat: update Dashboard with level, longestStreak, accuracy, and heat map

- Add secondary stats row (Level, Best Streak, Accuracy, Sessions)
- Add level progress bar
- Replace static WeeklyProgress with WeeklyProgressHeatmap
- Update share message to include level

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Add New Icons Export

**Files:**

- Modify: `src/components/icons/index.ts`

**Step 1: Add missing icon exports**

Add these exports if not present:

```typescript
export { HiOutlineTrendingUp, HiOutlineAcademicCap } from 'react-icons/hi';
```

**Step 2: Verify the exports**

Run: `grep -E "TrendingUp|AcademicCap" /home/linh/Downloads/rinkuzu/src/components/icons/index.ts`
Expected: Both icons exported

**Step 3: Commit**

```bash
git add src/components/icons/index.ts
git commit -m "feat: add TrendingUp and AcademicCap icon exports

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Test the Application

**Step 1: Run the development server**

Run: `cd /home/linh/Downloads/rinkuzu && npm run dev`
Expected: Server starts without errors

**Step 2: Manual verification checklist**

1. Open http://localhost:3000
2. Login with test account
3. Verify Dashboard shows:
   - [ ] Level calculated correctly (XP / 100 + 1)
   - [ ] Level progress bar shows correct percentage
   - [ ] longestStreak displayed in "Best Streak" card
   - [ ] 7-Day Accuracy shows percentage
   - [ ] Review Sessions count displayed
   - [ ] Weekly Progress shows heat map with real data
   - [ ] Week navigation arrows work
   - [ ] Heat map colors reflect activity intensity

**Step 3: Test a review session**

1. Start a review session
2. Answer a few questions
3. Return to dashboard
4. Verify:
   - [ ] XP increased
   - [ ] Today's heat map cell updated
   - [ ] Accuracy reflects responses

---

## Task 12: Final Commit and Summary

**Step 1: Create summary commit if any loose changes**

```bash
git status
# If any uncommitted changes:
git add .
git commit -m "chore: finalize dashboard gamification bug fixes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 2: Create tag for this milestone**

```bash
git tag -a v1.1.0-gamification-fixes -m "Dashboard gamification bug fixes complete"
```

---

## Summary of Changes

| Bug                            | Status   | Solution                                             |
| ------------------------------ | -------- | ---------------------------------------------------- |
| Level không tính               | ✅ Fixed | `calculateLevel(xp) = floor(xp/100) + 1`             |
| Weekly Progress static         | ✅ Fixed | New `WeeklyProgressHeatmap` component with real data |
| Accuracy placeholder           | ✅ Fixed | 7-day moving average calculation                     |
| longestStreak không hiển thị   | ✅ Fixed | Added "Best Streak" StatCard                         |
| totalReviewSessions không tăng | ✅ Fixed | Increment once per day on review                     |

## Files Changed

- Created: `src/lib/gamification.ts`
- Created: `src/lib/date-utils.ts`
- Created: `src/components/dashboard/WeeklyProgressHeatmap.tsx`
- Modified: `src/app/api/progress/stats/route.ts`
- Modified: `src/app/api/review/submit/route.ts`
- Modified: `src/models/UserProgress.ts`
- Modified: `src/hooks/useStats.ts`
- Modified: `src/app/_components/DashboardClient.tsx`
- Modified: `src/components/icons/index.ts`
