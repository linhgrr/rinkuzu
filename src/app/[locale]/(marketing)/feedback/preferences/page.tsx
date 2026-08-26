import { Suspense } from 'react';
import { FeedbackPreferencePage } from '@/features/communications/components/FeedbackPreferencePage';

export default function PublicFeedbackPreferencePage() {
  return (
    <Suspense fallback={<main className="p-8">Đang tải…</main>}>
      <FeedbackPreferencePage />
    </Suspense>
  );
}
