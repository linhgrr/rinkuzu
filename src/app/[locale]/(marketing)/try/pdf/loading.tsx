import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton of the guest upload page: badge, heading, drop zone and button. */
export default function TryPdfLoading() {
  return (
    <main className="min-h-dvh bg-neutral-50 px-4 py-8 sm:px-6">
      <div role="status" aria-label="Loading" className="mx-auto max-w-xl space-y-6">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl sm:w-64" />
      </div>
    </main>
  );
}
