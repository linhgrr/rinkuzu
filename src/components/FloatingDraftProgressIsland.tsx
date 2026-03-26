'use client';

import { DraftSyncProvider } from '@/components/providers/DraftSyncProvider';
import { FloatingDraftProgress } from '@/components/FloatingDraftProgress';

export default function FloatingDraftProgressIsland() {
  return (
    <DraftSyncProvider>
      <FloatingDraftProgress />
    </DraftSyncProvider>
  );
}
