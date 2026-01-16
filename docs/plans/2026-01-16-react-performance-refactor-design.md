# React Performance Refactor Design

**Date:** 2026-01-16
**Project:** RinKuzu Quiz App
**Scope:** Full refactor with Vercel React Best Practices

---

## Overview

Refactor toàn bộ project RinKuzu theo Vercel React Best Practices (45 rules) để tối ưu performance, bundle size, và developer experience.

## Current State Analysis

| Metric | Current | Target |
|--------|---------|--------|
| Homepage data fetching | Client-side useEffect | Server Components + Suspense |
| Bundle optimization | Barrel imports | Direct imports / optimizePackageImports |
| Component memoization | None | React.memo for list items |
| Data fetching pattern | Manual fetch | SWR for client mutations |
| Loading states | Simple spinner | Skeleton components |

### Issues Found

1. **Architecture Issues (CRITICAL)**
   - Homepage là `'use client'`, fetch data trong useEffect
   - Không sử dụng Server Components
   - Không có Suspense boundaries

2. **Bundle Size Issues (CRITICAL)**
   - Barrel imports từ `react-icons/hi` (loads entire library)
   - Heavy components không lazy loaded (PDFViewer, MarkdownRenderer)

3. **Re-render Issues (MEDIUM)**
   - StatCard, QuizCard không memoized
   - Inline functions trong JSX
   - Event handlers recreated mỗi render

4. **Data Fetching Issues (MEDIUM-HIGH)**
   - No SWR deduplication
   - No optimistic updates
   - Manual cache invalidation

---

## Design Sections

### Section 1: Architecture Changes

**New folder structure:**

```
src/app/
├── page.tsx                 # Server Component (fetch data on server)
├── _components/             # Page-specific client components
│   ├── DashboardClient.tsx  # Client wrapper với interactivity
│   ├── DashboardStats.tsx   # Server Component for stats
│   ├── StatCard.tsx         # Memoized component
│   └── QuizList.tsx         # Memoized list
├── layout.tsx               # Server Component (providers wrapper)
└── providers.tsx            # Client Component (NextAuth, etc.)
```

**Pattern applied:**
- Server Components cho data fetching
- Client Components chỉ cho interactivity
- Suspense boundaries cho streaming

**Rules applied:**
- `server-parallel-fetching` - Fetch data song song trên server
- `async-suspense-boundaries` - Streaming với Suspense
- `server-serialization` - Chỉ pass data cần thiết xuống client

---

### Section 2: Bundle Size Optimization

**Changes to next.config.js:**

```js
module.exports = {
  experimental: {
    optimizePackageImports: ['react-icons', 'react-markdown']
  }
}
```

**Dynamic imports for heavy components:**

```tsx
// Before
import { PDFViewer } from '@/components/ui/PDFViewer';

// After
const PDFViewer = dynamic(
  () => import('@/components/ui/PDFViewer').then(m => m.PDFViewer),
  { ssr: false, loading: () => <PDFViewerSkeleton /> }
);
```

**Files to refactor:**
- `src/app/page.tsx` - 6 icons
- `src/components/Navigation.tsx` - 10 icons
- `src/components/Sidebar.tsx`
- `src/components/BottomNav.tsx`
- `src/components/ui/PDFViewer.tsx` - dynamic import
- `src/components/ui/MarkdownRenderer.tsx` - dynamic import

**Rules applied:**
- `bundle-barrel-imports` - optimizePackageImports
- `bundle-dynamic-imports` - Lazy load heavy components
- `bundle-defer-third-party` - Defer analytics

---

### Section 3: Re-render Optimization

**Memoized components:**

```tsx
// StatCard.tsx
import { memo } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

export const StatCard = memo(function StatCard({
  label, value, icon, color
}: StatCardProps) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
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

**Stable callbacks with useCallback:**

```tsx
// Before
<Button onClick={() => router.push(ROUTES.CREATE_QUIZ)}>
  Create Quiz
</Button>

// After
const handleCreateQuiz = useCallback(() => {
  router.push(ROUTES.CREATE_QUIZ);
}, [router]);

<Button onClick={handleCreateQuiz}>
  Create Quiz
</Button>
```

**Functional setState:**

```tsx
// Before
setStats({
  ...stats,
  xp: data.data.xp,
  streakFreezeCount: data.data.streakFreezeCount
});

// After
setStats(prev => prev ? ({
  ...prev,
  xp: data.data.xp,
  streakFreezeCount: data.data.streakFreezeCount
}) : null);
```

**Components to memoize:**
- `StatCard` - renders multiple times, props rarely change
- `QuizCard` - renders in lists
- `Badge` - renders frequently
- `UserMenu` - dropdown rarely changes
- `CategoryBadge` - renders in lists

**Rules applied:**
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-functional-setstate` - Functional setState for stable callbacks
- `rerender-lazy-state-init` - Lazy initialization for expensive values

---

### Section 4: Data Fetching Patterns

**Server-side fetching with Suspense:**

```tsx
// src/app/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { StatsSection } from './_components/StatsSection';
import { QuizListSection } from './_components/QuizListSection';
import { StatsSkeleton, QuizListSkeleton } from '@/components/skeletons';

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <GuestLanding />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Navigation user={session.user} />

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection userId={session.user.id} />
      </Suspense>

      <Suspense fallback={<QuizListSkeleton />}>
        <QuizListSection userId={session.user.id} />
      </Suspense>
    </div>
  );
}
```

**SWR for client mutations:**

```tsx
// src/hooks/useStats.ts
import useSWR from 'swr';
import { useSWRMutation } from 'swr/mutation';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useStats() {
  const { data, mutate } = useSWR('/api/progress/stats', fetcher);

  const { trigger: buyFreeze, isMutating } = useSWRMutation(
    '/api/shop/buy-freeze',
    async (url) => {
      const res = await fetch(url, { method: 'POST' });
      return res.json();
    },
    {
      onSuccess: (data) => {
        if (data.success) {
          mutate(); // Revalidate stats
        }
      }
    }
  );

  return {
    stats: data,
    buyFreeze,
    isBuyingFreeze: isMutating
  };
}
```

**Rules applied:**
- `async-suspense-boundaries` - Stream content with Suspense
- `client-swr-dedup` - SWR for automatic deduplication
- `async-parallel` - Promise.all for independent operations

---

### Section 5: Component Structure

**New component organization:**

```
src/
├── app/
│   ├── page.tsx                    # Server Component
│   ├── _components/                # Page-specific components
│   │   ├── DashboardStats.tsx      # Server Component
│   │   ├── DashboardClient.tsx     # Client interactivity
│   │   └── GuestLanding.tsx        # Static landing
│   ├── layout.tsx                  # Root layout
│   └── providers.tsx               # Client providers
│
├── components/
│   ├── ui/                         # Primitive UI (keep as-is)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── shared/                     # Shared across pages
│   │   ├── Navigation/
│   │   │   ├── index.tsx           # Server wrapper
│   │   │   ├── NavClient.tsx       # Client interactivity
│   │   │   └── UserMenu.tsx        # Memoized dropdown
│   │   ├── StatCard.tsx            # Memoized
│   │   └── QuizCard.tsx            # Memoized
│   └── skeletons/                  # Loading states
│       ├── StatsSkeleton.tsx
│       └── QuizListSkeleton.tsx
│
├── hooks/
│   ├── useStats.ts                 # SWR hook
│   ├── useQuizzes.ts               # SWR hook
│   └── useDebounce.ts              # Utility hook
│
└── lib/
    ├── fetcher.ts                  # SWR fetcher
    ├── cache.ts                    # React.cache wrappers
    └── ...
```

---

### Section 6: Quick Wins (Apply immediately)

| Rule | File | Change |
|------|------|--------|
| `bundle-barrel-imports` | `next.config.js` | Add `optimizePackageImports: ['react-icons']` |
| `rendering-conditional-render` | `page.tsx` | `{count && ...}` → `{count > 0 ? ... : null}` |
| `rerender-lazy-state-init` | useState calls | `useState(expensive())` → `useState(() => expensive())` |
| `js-tosorted-immutable` | Sort operations | `.sort()` → `.toSorted()` |

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
1. Add `optimizePackageImports` to next.config.js
2. Fix conditional rendering patterns
3. Add React.memo to StatCard, Badge

### Phase 2: Architecture (4-6 hours)
1. Convert Homepage to Server Component
2. Create Suspense boundaries
3. Create skeleton components
4. Split Navigation into server/client parts

### Phase 3: Data Fetching (2-3 hours)
1. Install SWR: `npm install swr`
2. Create useStats, useQuizzes hooks
3. Migrate mutations to useSWRMutation

### Phase 4: Full Component Refactor (4-6 hours)
1. Memoize all list components
2. Add useCallback to event handlers
3. Create shared components folder
4. Dynamic import heavy components

---

## Verification

After implementation, verify:
- [ ] `npm run build` passes
- [ ] `npm run dev` works without errors
- [ ] Bundle size reduced (check with `npx @next/bundle-analyzer`)
- [ ] No hydration mismatches in console
- [ ] Loading states work correctly

---

## References

- [Vercel React Best Practices](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [SWR Documentation](https://swr.vercel.app)
