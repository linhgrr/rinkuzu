export function AdaptiveDashboardRouteSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <main className="mx-auto w-full max-w-7xl p-8 md:p-12">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="w-full max-w-xl">
            <div className="h-12 w-72 animate-pulse rounded-lg bg-neutral-200 md:h-14" />
            <div className="mt-3 h-6 w-full max-w-md animate-pulse rounded bg-neutral-200" />
            <div className="mt-4 h-7 w-48 animate-pulse rounded-full bg-neutral-200" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-11 w-36 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-11 w-44 animate-pulse rounded-full bg-neutral-200" />
          </div>
        </div>

        <section className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="h-[23rem] animate-pulse rounded-2xl border border-neutral-200 bg-white/70 lg:col-span-8" />
          <div className="h-[23rem] animate-pulse rounded-2xl border border-neutral-200 bg-white/70 lg:col-span-4" />
        </section>

        <section className="mb-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="h-9 w-64 animate-pulse rounded bg-neutral-200" />
              <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-neutral-200" />
            </div>
            <div className="hidden h-10 w-56 animate-pulse rounded-full bg-neutral-200 sm:block" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[21rem] animate-pulse rounded-2xl border border-neutral-200 bg-white/70"
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
