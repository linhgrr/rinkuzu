import { AdminUsersPageSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <AdminUsersPageSkeleton />
      </div>
    </div>
  );
}
