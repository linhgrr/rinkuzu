export function MarkdownSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {/* Heading skeleton */}
      <div className="h-5 bg-gray-200 rounded w-3/4" />

      {/* Paragraph skeletons */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
      </div>

      {/* List skeleton */}
      <div className="space-y-2 ml-4">
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-3/5" />
      </div>

      {/* Another paragraph */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
      </div>
    </div>
  );
}
