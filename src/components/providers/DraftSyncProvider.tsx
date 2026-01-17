// src/components/providers/DraftSyncProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';

const SYNC_INTERVAL = 30000; // 30 seconds

export function DraftSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { getActiveDrafts, cleanupExpiredDrafts, syncWithServer } = useDraftStore();
  const { resumeProcessing } = usePdfProcessor();
  const hasInitialized = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Initial sync and resume on mount
  useEffect(() => {
    if (!session?.user || hasInitialized.current) return;
    hasInitialized.current = true;

    const initSync = async () => {
      // Cleanup expired first
      cleanupExpiredDrafts();

      // Fetch server state
      try {
        const response = await fetch('/api/draft/list');
        if (response.ok) {
          const { drafts } = await response.json();
          syncWithServer(drafts);

          // Resume processing drafts
          const localDrafts = getActiveDrafts();
          localDrafts
            .filter(d => d.status === 'processing')
            .forEach(d => {
              // Check if server says it's still processing
              const serverDraft = drafts.find((sd: any) => sd._id === d.id);
              if (serverDraft && serverDraft.status === 'processing') {
                resumeProcessing(d.id);
              }
            });
        }
      } catch (error) {
        console.error('Failed to sync drafts:', error);
      }
    };

    initSync();

    // Periodic sync
    syncIntervalRef.current = setInterval(() => {
      cleanupExpiredDrafts();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [session, cleanupExpiredDrafts, syncWithServer, getActiveDrafts, resumeProcessing]);

  return <>{children}</>;
}
