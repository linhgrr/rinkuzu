export function MarkdownSkeleton() {
  return (
    <div className="space-y-3">
      {/* Heading skeleton */}
      <div className="h-5 skeleton-shimmer rounded w-3/4" />

      {/* Paragraph skeletons */}
      <div className="space-y-2">
        <div className="h-4 skeleton-shimmer rounded w-full" />
        <div className="h-4 skeleton-shimmer rounded w-5/6" />
        <div className="h-4 skeleton-shimmer rounded w-4/5" />
      </div>

      {/* List skeleton */}
      <div className="space-y-2 ml-4">
        <div className="h-3 skeleton-shimmer rounded w-2/3" />
        <div className="h-3 skeleton-shimmer rounded w-1/2" />
        <div className="h-3 skeleton-shimmer rounded w-3/5" />
      </div>

      {/* Another paragraph */}
      <div className="space-y-2">
        <div className="h-4 skeleton-shimmer rounded w-full" />
        <div className="h-4 skeleton-shimmer rounded w-4/5" />
      </div>
    </div>
  );
}
