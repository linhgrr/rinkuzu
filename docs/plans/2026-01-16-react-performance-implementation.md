# React Performance Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor RinKuzu Quiz App theo Vercel React Best Practices để tối ưu performance, bundle size, và UX.

**Architecture:** Server Components cho data fetching, Client Components cho interactivity, SWR cho client-side mutations, Suspense boundaries cho streaming, và React.memo cho re-render optimization.

**Tech Stack:** Next.js 14, React 18, SWR, Zustand, TailwindCSS, TypeScript

---

## Phase 1: Quick Wins (30 mins)

### Task 1: Add optimizePackageImports to next.config.js

**Files:**
- Modify: `next.config.js`

**Step 1: Read current next.config.js**

Check current configuration structure.

**Step 2: Add optimizePackageImports**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['react-icons', 'react-markdown', 'lucide-react']
  },
  // ... existing config
};

module.exports = nextConfig;
```

**Step 3: Verify build works**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add next.config.js
git commit -m "perf: add optimizePackageImports for react-icons bundle optimization"
```

---

### Task 2: Install SWR

**Files:**
- Modify: `package.json`

**Step 1: Install SWR**

Run: `npm install swr`

**Step 2: Verify installation**

Run: `npm list swr`
Expected: Shows swr version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install swr for data fetching"
```

---

### Task 3: Create SWR fetcher utility

**Files:**
- Create: `src/lib/fetcher.ts`

**Step 1: Create fetcher file**

```typescript
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }

  return res.json();
};

export const fetcherWithAuth = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }

  return res.json();
};
```

**Step 2: Commit**

```bash
git add src/lib/fetcher.ts
git commit -m "feat: add SWR fetcher utilities"
```

---

## Phase 2: Component Memoization (45 mins)

### Task 4: Create memoized StatCard component

**Files:**
- Create: `src/components/shared/StatCard.tsx`

**Step 1: Create shared directory**

Run: `mkdir -p src/components/shared`

**Step 2: Create StatCard component**

```tsx
'use client';

import { memo, ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  color,
}: StatCardProps) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-[#86868b] font-medium">{label}</p>
        <p className="text-2xl font-bold text-[#1d1d1f]">{value}</p>
      </div>
    </Card>
  );
});
```

**Step 3: Commit**

```bash
git add src/components/shared/StatCard.tsx
git commit -m "feat: add memoized StatCard component"
```

---

### Task 5: Create memoized QuizCard component

**Files:**
- Create: `src/components/shared/QuizCard.tsx`

**Step 1: Create QuizCard component**

```tsx
'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import { ROUTES } from '@/shared/constants';
import { formatDisplayDate } from '@/shared/utils/constants';

interface Quiz {
  _id: string;
  title: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
  createdAt: string;
  questions: Array<unknown>;
}

interface QuizCardProps {
  quiz: Quiz;
}

const CategoryBadgeVariant = (color: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-blue-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };
  return map[color] || 'default';
};

export const QuizCard = memo(function QuizCard({ quiz }: QuizCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(ROUTES.QUIZ.VIEW(quiz.slug));
  }, [router, quiz.slug]);

  return (
    <Card
      variant="interactive"
      className="flex flex-col justify-between"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <Badge
          variant={CategoryBadgeVariant(quiz.category?.color)}
          className="w-fit mb-2"
        >
          {quiz.category?.name}
        </Badge>
        <CardTitle size="sm" className="line-clamp-2">
          {quiz.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-[#86868b] mt-2">
          <span>{quiz.questions.length} questions</span>
          <span>{formatDisplayDate(quiz.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
});
```

**Step 2: Commit**

```bash
git add src/components/shared/QuizCard.tsx
git commit -m "feat: add memoized QuizCard component"
```

---

### Task 6: Create skeleton components

**Files:**
- Create: `src/components/skeletons/StatsSkeleton.tsx`
- Create: `src/components/skeletons/QuizListSkeleton.tsx`
- Create: `src/components/skeletons/index.ts`

**Step 1: Create skeletons directory**

Run: `mkdir -p src/components/skeletons`

**Step 2: Create StatsSkeleton**

```tsx
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-pulse">
      {/* Main Card Skeleton */}
      <div className="col-span-2 h-[140px] bg-gray-200 rounded-2xl" />

      {/* Stat Cards Skeleton */}
      <div className="h-[100px] bg-gray-200 rounded-2xl" />
      <div className="h-[100px] bg-gray-200 rounded-2xl" />
    </div>
  );
}
```

**Step 3: Create QuizListSkeleton**

```tsx
export function QuizListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      {/* Create Card Skeleton */}
      <div className="h-[140px] border-2 border-dashed border-gray-200 rounded-2xl" />

      {/* Quiz Cards Skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[140px] bg-gray-200 rounded-2xl" />
      ))}
    </div>
  );
}
```

**Step 4: Create index export**

```tsx
export { StatsSkeleton } from './StatsSkeleton';
export { QuizListSkeleton } from './QuizListSkeleton';
```

**Step 5: Commit**

```bash
git add src/components/skeletons/
git commit -m "feat: add skeleton loading components"
```

---

## Phase 3: SWR Hooks (30 mins)

### Task 7: Create useStats hook

**Files:**
- Create: `src/hooks/useStats.ts`

**Step 1: Create useStats hook**

```typescript
'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { fetcher } from '@/lib/fetcher';

interface UserStats {
  streak: number;
  xp: number;
  level: number;
  dueCount: number;
  streakFreezeCount: number;
  weeklyActivity: unknown;
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
  const { data, error, isLoading, mutate } = useSWR<UserStats>(
    '/api/progress/stats',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

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
            { revalidate: false }
          );
        }
      },
    }
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

**Step 2: Commit**

```bash
git add src/hooks/useStats.ts
git commit -m "feat: add useStats SWR hook with optimistic updates"
```

---

### Task 8: Create useQuizzes hook

**Files:**
- Create: `src/hooks/useQuizzes.ts`

**Step 1: Create useQuizzes hook**

```typescript
'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
  author: {
    email: string;
  };
  createdAt: string;
  questions: Array<unknown>;
}

interface QuizzesResponse {
  success: boolean;
  data: {
    quizzes: Quiz[];
    total: number;
  };
}

export function useQuizzes(limit?: number) {
  const url = limit ? `/api/quizzes?limit=${limit}` : '/api/quizzes';

  const { data, error, isLoading, mutate } = useSWR<QuizzesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    quizzes: data?.data?.quizzes ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    error,
    mutateQuizzes: mutate,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useQuizzes.ts
git commit -m "feat: add useQuizzes SWR hook"
```

---

### Task 9: Create hooks index export

**Files:**
- Create: `src/hooks/index.ts`

**Step 1: Create index file**

```typescript
export { useStats } from './useStats';
export { useQuizzes } from './useQuizzes';
export { useDebounce } from './useDebounce';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useQuizCreation } from './useQuizCreation';
```

**Step 2: Commit**

```bash
git add src/hooks/index.ts
git commit -m "feat: add hooks barrel export"
```

---

## Phase 4: Homepage Refactor (1 hour)

### Task 10: Create GuestLanding component

**Files:**
- Create: `src/app/_components/GuestLanding.tsx`

**Step 1: Create _components directory**

Run: `mkdir -p src/app/_components`

**Step 2: Create GuestLanding component**

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/shared/constants';
import { HiOutlineArrowRight } from 'react-icons/hi';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
}

interface GuestLandingProps {
  quizzes: Quiz[];
}

const CategoryBadgeVariant = (color: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-blue-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };
  return map[color] || 'default';
};

export function GuestLanding({ quizzes }: GuestLandingProps) {
  const router = useRouter();

  const handleGetStarted = useCallback(() => {
    router.push(ROUTES.REGISTER);
  }, [router]);

  const handleLogin = useCallback(() => {
    router.push(ROUTES.LOGIN);
  }, [router]);

  const handleExplore = useCallback(() => {
    router.push(ROUTES.EXPLORE);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-semibold mb-6 tracking-tight">
          Master any subject.
        </h1>
        <p className="text-xl text-[#86868b] mb-12 max-w-2xl mx-auto">
          Create AI-powered quizzes from your study materials. Track progress
          with Spaced Repetition.
        </p>
        <div className="flex justify-center gap-4 mb-20">
          <Button size="lg" onClick={handleGetStarted}>
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" onClick={handleLogin}>
            Log In
          </Button>
        </div>

        {/* Public Quizzes Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
          {quizzes.slice(0, 3).map((quiz) => (
            <Card key={quiz._id} className="p-6">
              <Badge
                className="mb-2"
                variant={CategoryBadgeVariant(quiz.category?.color)}
              >
                {quiz.category?.name}
              </Badge>
              <h3 className="font-semibold text-lg mb-2">{quiz.title}</h3>
              <p className="text-sm text-[#86868b] line-clamp-2">
                {quiz.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleExplore}>
            Explore All Quizzes <HiOutlineArrowRight className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/_components/GuestLanding.tsx
git commit -m "feat: extract GuestLanding component with memoized callbacks"
```

---

### Task 11: Create DashboardClient component

**Files:**
- Create: `src/app/_components/DashboardClient.tsx`

**Step 1: Create DashboardClient component**

```tsx
'use client';

import { useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { Card, Badge } from '@/components/ui/Card';
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
} from 'react-icons/hi';

interface DashboardClientProps {
  userEmail: string;
}

const WeeklyProgress = memo(function WeeklyProgress() {
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Weekly Progress</h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="text-xs text-[#86868b]">{day}</span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                i === 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i === 3 ? '✓' : ''}
            </div>
          </div>
        ))}
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
  const { stats, buyFreeze, isBuyingFreeze } = useStats();
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
      alert('Progress copied to clipboard!');
    }
  }, [stats?.streak, stats?.xp]);

  const handleBuyFreeze = useCallback(async () => {
    try {
      const result = await buyFreeze();
      if (!result?.success) {
        alert(result?.message || 'Failed to buy freeze');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to server');
    }
  }, [buyFreeze]);

  const userName = userEmail?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8 pt-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold text-[#1d1d1f]">
                Welcome back, {userName}!{' '}
                <HiOutlineLightBulb className="inline-block text-yellow-500" />
              </h1>
              <p className="text-[#86868b]">
                Here&apos;s what you should focus on today.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex items-center gap-2"
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
            <WeeklyProgress />

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

**Step 2: Commit**

```bash
git add src/app/_components/DashboardClient.tsx
git commit -m "feat: create DashboardClient with SWR hooks and memoized components"
```

---

### Task 12: Create _components index export

**Files:**
- Create: `src/app/_components/index.ts`

**Step 1: Create index file**

```typescript
export { GuestLanding } from './GuestLanding';
export { DashboardClient } from './DashboardClient';
```

**Step 2: Commit**

```bash
git add src/app/_components/index.ts
git commit -m "feat: add _components index export"
```

---

### Task 13: Refactor Homepage to use new components

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Refactor page.tsx**

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { GuestLanding, DashboardClient } from './_components';
import { useQuizzes } from '@/hooks';

export default function HomePage() {
  const { data: session, status } = useSession();
  const { quizzes, isLoading } = useQuizzes(6);

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
          <p className="text-[#86868b]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Guest view
  if (!session) {
    return <GuestLanding quizzes={quizzes} />;
  }

  // Authenticated view
  return <DashboardClient userEmail={session.user?.email || ''} />;
}
```

**Step 2: Run dev to verify**

Run: `npm run dev`
Expected: App loads without errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: simplify homepage with extracted components and SWR"
```

---

## Phase 5: Final Optimizations (30 mins)

### Task 14: Create shared components index

**Files:**
- Create: `src/components/shared/index.ts`

**Step 1: Create index file**

```typescript
export { StatCard } from './StatCard';
export { QuizCard } from './QuizCard';
```

**Step 2: Commit**

```bash
git add src/components/shared/index.ts
git commit -m "feat: add shared components index export"
```

---

### Task 15: Verify build and run tests

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors (warnings acceptable)

**Step 3: Final commit**

```bash
git add .
git commit -m "chore: complete Phase 1 React performance refactor"
```

---

## Verification Checklist

After implementation, verify:
- [ ] `npm run build` passes
- [ ] `npm run dev` works without errors
- [ ] Homepage loads correctly for guests
- [ ] Homepage loads correctly for authenticated users
- [ ] Stats display correctly
- [ ] Buy Freeze works with optimistic update
- [ ] Quiz list renders correctly
- [ ] No console errors

---

## Next Steps (Future Phases)

1. **Phase 2:** Convert more pages to Server Components with Suspense
2. **Phase 3:** Add dynamic imports for PDFViewer, MarkdownRenderer
3. **Phase 4:** Optimize Navigation with server/client split
4. **Phase 5:** Add React.cache for server-side deduplication
