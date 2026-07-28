import { Skeleton } from '@/components/ui/Skeleton';

export function AdaptiveDashboardRouteSkeleton() {
  return (
    <div
      className="pb-16 font-home sm:pb-20"
      aria-busy="true"
      aria-label="Loading personal learning dashboard"
    >
      <div className="mb-5 space-y-2 sm:mb-6">
        <Skeleton className="h-8 w-72 max-w-full rounded-md" />
        <Skeleton className="h-6 w-[32rem] max-w-full rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 min-[1684px]:grid-cols-[minmax(0,900px)_416px] min-[1684px]:gap-6">
        <div className="min-w-0 md:col-span-2 min-[1684px]:col-span-1 min-[1684px]:col-start-1 min-[1684px]:row-start-1">
          <Skeleton className="min-h-[340px] rounded-2xl border border-accent/40 sm:min-h-[320px] md:h-[308px] md:min-h-0 md:rounded-panel" />
        </div>

        <div className="min-w-0 md:col-start-1 md:row-start-2 min-[1684px]:col-start-2 min-[1684px]:row-start-1">
          <section className="flex h-full min-h-[260px] flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:min-h-[280px] sm:gap-5 sm:p-5 md:min-h-[308px] md:rounded-panel min-[1684px]:h-[308px]">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-5 w-64 max-w-full rounded-md" />
            </div>
            <Skeleton className="min-h-[170px] flex-1 rounded-control" />
          </section>
        </div>

        <div className="min-w-0 md:col-span-2 md:row-start-3 min-[1684px]:col-span-1 min-[1684px]:col-start-1 min-[1684px]:row-start-2">
          <section className="flex min-h-[420px] flex-col gap-5 rounded-2xl border border-line bg-surface p-4 sm:min-h-[555px] sm:gap-6 sm:p-5 md:rounded-panel">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded-md" />
              <Skeleton className="h-5 w-72 max-w-full rounded-md" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 min-[1500px]:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton
                  key={`adaptive-library-skeleton-${index}`}
                  className="min-h-[196px] rounded-xl border border-accent-warm/30 sm:min-h-[212px]"
                />
              ))}
            </div>
          </section>
        </div>

        <div className="min-w-0 md:col-start-2 md:row-start-2 min-[1684px]:col-start-2">
          <section className="h-full min-h-[280px] rounded-2xl border border-line bg-surface p-4 sm:min-h-[308px] sm:p-5 md:min-h-[343px] md:rounded-panel">
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="mt-6 space-y-5">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={`adaptive-activity-skeleton-${index}`} className="space-y-2">
                  <Skeleton className="h-5 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
