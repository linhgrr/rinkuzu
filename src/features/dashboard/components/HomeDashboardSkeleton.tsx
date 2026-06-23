import { Skeleton } from '@/components/ui/Skeleton';

function SectionHeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-44 rounded-md" />
      <Skeleton className="h-5 w-64 max-w-full rounded-md" />
    </div>
  );
}

function LearningCardSkeleton() {
  return (
    <div className="flex min-h-[181px] flex-col rounded-xl border border-line bg-surface-blue p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="size-6 rounded-md" />
      </div>
      <div className="mt-auto space-y-3">
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-5 w-3/5 rounded-md" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function HomeDashboardSkeleton() {
  return (
    <div
      className="px-4 pb-20 pt-5 font-home sm:px-6 sm:pt-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="mx-auto max-w-[1340px]">
        <div className="mb-5 space-y-2 sm:mb-6">
          <Skeleton className="h-8 w-72 max-w-full rounded-md" />
          <Skeleton className="h-6 w-80 max-w-full rounded-md" />
        </div>

        <div className="grid grid-cols-1 gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="min-h-[280px] rounded-[20px] border border-accent/40 bg-hero p-5 sm:min-h-[295px] sm:p-6">
              <Skeleton className="h-10 w-[28rem] max-w-full rounded-lg" />
              <Skeleton className="mt-5 h-5 w-full max-w-[32rem] rounded-md" />
              <Skeleton className="mt-2 h-5 w-4/5 max-w-[26rem] rounded-md" />
              <Skeleton className="mt-9 h-12 w-40 rounded-full" />
            </div>

            <section className="flex flex-col gap-6 rounded-[20px] border border-line bg-surface p-4 sm:p-5">
              <SectionHeadingSkeleton />
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 min-[1180px]:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <LearningCardSkeleton key={`home-learning-skeleton-${index}`} />
                ))}
              </div>
            </section>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 min-[1684px]:flex min-[1684px]:flex-col">
            <section className="flex min-h-[280px] flex-col gap-6 rounded-[20px] border border-line bg-surface p-4 sm:min-h-[295px] sm:p-5">
              <SectionHeadingSkeleton />
              <Skeleton className="min-h-[170px] flex-1 rounded-[10px]" />
            </section>

            <section className="flex min-h-[357px] flex-col gap-6 rounded-[20px] border border-line bg-surface p-4 sm:gap-7 sm:p-5">
              <SectionHeadingSkeleton />
              <div className="flex items-center justify-between gap-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={`home-metric-skeleton-${index}`}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <Skeleton className="size-12 rounded-full" />
                    <Skeleton className="h-4 w-20 max-w-full rounded-md" />
                    <Skeleton className="h-7 w-12 rounded-md" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-[104px] w-full rounded-[10px]" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
