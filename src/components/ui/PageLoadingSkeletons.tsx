import { Skeleton } from '@/components/ui/Skeleton';

interface PageSkeletonProps {
  label: string;
}

export function CenteredCardPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-surface-page px-4 py-8" aria-busy="true" aria-label={label}>
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <div className="w-full rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-surface-blue">
            <Skeleton className="size-10 rounded-xl" />
          </div>
          <div className="space-y-3 text-center">
            <Skeleton className="mx-auto h-7 w-56 max-w-full rounded-md" />
            <Skeleton className="mx-auto h-5 w-80 max-w-full rounded-md" />
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={`centered-card-option-skeleton-${index}`}
                className="h-12 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuizWorkspacePageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72 max-w-full rounded-md" />
            <Skeleton className="h-5 w-96 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
        </div>
        <div className="rounded-2xl border border-line-blue/30 bg-white p-6">
          <Skeleton className="h-7 w-2/3 rounded-md" />
          <Skeleton className="mt-3 h-5 w-1/2 rounded-md" />
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`quiz-workspace-row-skeleton-${index}`} className="rounded-xl border p-4">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="mt-3 h-4 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlashcardPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8" aria-busy="true" aria-label={label}>
      <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center">
        <div className="mb-8 space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-64 max-w-full rounded-md" />
          <Skeleton className="mx-auto h-5 w-80 max-w-full rounded-md" />
        </div>
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-line-blue/30 bg-white p-8 shadow-sm">
          <Skeleton className="mx-auto h-8 w-3/4 rounded-md" />
          <Skeleton className="mx-auto mt-4 h-5 w-1/2 rounded-md" />
          <div className="mt-12 flex justify-center gap-4">
            <Skeleton className="h-12 w-32 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileListPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-5 w-80 max-w-full rounded-md" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`profile-list-row-skeleton-${index}`}
            className="rounded-2xl border border-line-blue/30 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-6 w-3/5 rounded-md" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
                <Skeleton className="h-4 w-2/5 rounded-md" />
              </div>
              <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSettingsPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-5 w-96 max-w-full rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-line-blue/30 bg-white p-6">
          <Skeleton className="mx-auto size-28 rounded-full" />
          <Skeleton className="mx-auto mt-5 h-10 w-36 rounded-full" />
        </div>
        <div className="rounded-2xl border border-line-blue/30 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`profile-settings-field-skeleton-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-24 rounded-xl" />
          <div className="mt-6 flex justify-end">
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-surface-page px-4 py-8" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-72 max-w-full rounded-md" />
          <Skeleton className="h-5 w-96 max-w-full rounded-md" />
        </div>
        <Skeleton className="mb-8 h-32 rounded-2xl border border-line-blue/30" />
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`subscription-plan-skeleton-${index}`}
              className="rounded-2xl border border-line-blue/30 bg-white p-6"
            >
              <Skeleton className="h-6 w-32 rounded-md" />
              <Skeleton className="mt-4 h-9 w-24 rounded-md" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
              <Skeleton className="mt-8 h-11 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PaymentStatusPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-8"
      aria-busy="true"
      aria-label={label}
    >
      <div className="w-full max-w-md rounded-2xl border border-line-blue/30 bg-white p-8 text-center">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto mt-6 h-7 w-56 max-w-full rounded-md" />
        <Skeleton className="mx-auto mt-3 h-5 w-72 max-w-full rounded-md" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function QuizResultPageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-surface-page px-4 py-8" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-line-blue/30 bg-white p-6">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="mt-3 h-5 w-96 max-w-full rounded-md" />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={`quiz-result-stat-skeleton-${index}`} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="min-h-[220px] rounded-2xl border border-line-blue/30" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={`quiz-result-question-skeleton-${index}`}
              className="h-32 rounded-2xl border border-line-blue/30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModalListSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="space-y-2 py-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={`modal-list-skeleton-${index}`} className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5 rounded-md" />
              <Skeleton className="h-4 w-2/5 rounded-md" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
