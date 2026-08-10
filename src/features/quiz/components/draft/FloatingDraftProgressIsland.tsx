'use client';

import { DraftSyncProvider } from '@/components/providers/DraftSyncProvider';
import { FloatingDraftProgress } from '@/features/quiz/components/draft/FloatingDraftProgress';

export default function FloatingDraftProgressIsland() {
  return (
    <DraftSyncProvider>
      <FloatingDraftProgress />
    </DraftSyncProvider>
  );
}
