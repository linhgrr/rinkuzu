import { Suspense } from 'react';
import { AdminSupportPage } from '@/features/communications/components/AdminSupportPage';

export default function AdminSupportRoute() {
  return (
    <Suspense fallback={<div className="p-8">Đang tải…</div>}>
      <AdminSupportPage />
    </Suspense>
  );
}
