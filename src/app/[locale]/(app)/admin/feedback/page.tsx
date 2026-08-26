import { Suspense } from 'react';
import { AdminFeedbackPage } from '@/features/communications/components/AdminFeedbackPage';

export default function AdminFeedbackRoute() {
  return (
    <Suspense fallback={<div className="p-8">Đang tải…</div>}>
      <AdminFeedbackPage />
    </Suspense>
  );
}
