export function QuizListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      {/* Create Card Skeleton */}
      <div className="h-[140px] border-2 border-dashed border-gray-200 rounded-2xl" />

      {/* Quiz Cards Skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[140px] bg-gray-200 rounded-2xl" />
      ))}
    </div>
  );
}
