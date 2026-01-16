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
