export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" aria-hidden="true">
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-3">
              <div className="h-10 w-72 skeleton-shimmer rounded-xl" />
              <div className="h-6 w-48 skeleton-shimmer rounded-xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[300px] rounded-[2rem] skeleton-shimmer" />
              <div className="h-[300px] rounded-[2rem] skeleton-shimmer" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`dashboard-stat-loading-${index}`}
                  className="h-24 rounded-2xl skeleton-shimmer"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`dashboard-card-loading-${index}`}
                  className="h-40 rounded-2xl skeleton-shimmer"
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="h-56 rounded-2xl skeleton-shimmer" />
            <div className="h-44 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
          </div>
        </div>
      </main>
    </div>
  );
}
