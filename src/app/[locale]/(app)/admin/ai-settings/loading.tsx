import { AdminPageShell } from '@/components/admin/AdminPageShell';

export default function AdminAiSettingsLoading() {
  return (
    <AdminPageShell>
      <div className="space-y-4" aria-busy="true" aria-label="Loading AI settings">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-100" />
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="h-96 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-96 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      </div>
    </AdminPageShell>
  );
}
