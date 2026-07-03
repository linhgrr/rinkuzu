import { Skeleton } from '@/components/ui/Skeleton';

function AdminHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72 max-w-full rounded-md" />
        <Skeleton className="h-5 w-96 max-w-full rounded-md" />
      </div>
      {withAction ? <Skeleton className="h-11 w-36 shrink-0 rounded-full" /> : null}
    </div>
  );
}

function AdminFilterSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center">
      {Array.from({ length: fields }, (_, index) => (
        <Skeleton
          key={`admin-filter-skeleton-${index}`}
          className={index === 0 ? 'h-11 flex-1 rounded-xl' : 'h-11 w-36 rounded-xl'}
        />
      ))}
    </div>
  );
}

function AdminStatsCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`admin-stat-card-skeleton-${index}`}
          className="rounded-2xl border border-line-blue/30 bg-white p-5"
        >
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="mt-3 h-4 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function AdminTableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-blue/30 bg-white">
      <div className="border-b border-line-blue/25 p-6">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid gap-4 border-b border-line-blue/25 bg-neutral-50 px-6 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, index) => (
              <Skeleton key={`admin-table-head-skeleton-${index}`} className="h-4 rounded-md" />
            ))}
          </div>
          <div className="divide-y divide-line-blue/20">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <div
                key={`admin-table-row-skeleton-${rowIndex}`}
                className="grid gap-4 px-6 py-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <Skeleton
                    key={`admin-table-cell-skeleton-${rowIndex}-${columnIndex}`}
                    className="h-5 rounded-md"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-blue/30 bg-white">
      <div className="divide-y divide-line-blue/25">
        {Array.from({ length: rows }, (_, index) => (
          <article
            key={`admin-list-row-skeleton-${index}`}
            className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-6 w-3/5 rounded-md" />
              <Skeleton className="h-4 w-2/5 rounded-md" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading users">
      <AdminHeaderSkeleton />
      <AdminFilterSkeleton fields={2} />
      <AdminStatsCardsSkeleton count={4} />
      <AdminTableSkeleton columns={5} rows={6} />
    </div>
  );
}

export function AdminReportsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading reports">
      <AdminHeaderSkeleton />
      <AdminFilterSkeleton fields={4} />
      <AdminStatsCardsSkeleton count={4} />
      <AdminTableSkeleton columns={5} rows={6} />
    </div>
  );
}

export function AdminSubscriptionsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading subscriptions">
      <AdminHeaderSkeleton />
      <AdminFilterSkeleton fields={3} />
      <AdminStatsCardsSkeleton count={4} />
      <AdminTableSkeleton columns={7} rows={6} />
    </div>
  );
}

export function AdminPlansPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading billing plans">
      <AdminHeaderSkeleton withAction />
      <AdminStatsCardsSkeleton count={3} />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={`admin-plan-card-skeleton-${index}`}
            className="rounded-2xl border border-line-blue/30 bg-white p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-36 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
            <div className="mt-6 flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-full" />
              <Skeleton className="h-10 flex-1 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStatsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading statistics">
      <AdminHeaderSkeleton />
      <AdminStatsCardsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminTableSkeleton columns={3} rows={5} />
        <AdminTableSkeleton columns={3} rows={5} />
      </div>
    </div>
  );
}

export function AdminQuizzesListSkeleton() {
  return <AdminListSkeleton rows={6} />;
}
