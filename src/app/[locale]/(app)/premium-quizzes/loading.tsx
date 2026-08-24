import { PremiumCatalogCardSkeleton } from '@/features/quiz/components/PremiumCatalogCard';

export default function PremiumQuizzesLoading() {
  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-app space-y-5">
        <div className="h-40 rounded-2xl skeleton-shimmer" />
        <div className="h-12 max-w-2xl rounded-xl skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <PremiumCatalogCardSkeleton key={`premium-route-loading-${index}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
