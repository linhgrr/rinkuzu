import { memo } from 'react';
import { Card } from '@/components/ui/Card';

export const StatCardsSkeleton = memo(function StatCardsSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm border-gray-100/50 p-0 overflow-hidden" aria-hidden="true">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100/50">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`stats-skeleton-${index}`} className="p-5 flex items-center gap-4 bg-white">
            <div className="w-12 h-12 rounded-xl skeleton-shimmer shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3 w-16 skeleton-shimmer" />
              <div className="h-7 w-20 skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export const QuizCardsSkeleton = memo(function QuizCardsSkeleton() {
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

export const SidebarSkeleton = memo(function SidebarSkeleton() {
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