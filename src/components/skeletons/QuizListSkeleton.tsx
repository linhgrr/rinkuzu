export function QuizListSkeleton() {
  const skeletonKeys = ['quiz-1', 'quiz-2', 'quiz-3', 'quiz-4', 'quiz-5'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Create Card Skeleton */}
      <div className="h-[140px] border-2 border-dashed border-neutral-200 rounded-2xl" />

      {/* Quiz Cards Skeleton */}
      {skeletonKeys.map((skeletonKey) => (
        <div key={skeletonKey} className="h-[140px] skeleton-shimmer rounded-2xl" />
      ))}
    </div>
  );
}
