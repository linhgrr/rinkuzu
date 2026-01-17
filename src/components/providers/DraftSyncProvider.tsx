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
  const processingDraftsRef = useRef<Set<string>>(new Set());

  // Initial sync on mount
  useEffect(() => {
    if (!session?.user || hasInitialized.current) return;
    hasInitialized.current = true;

    const initSync = async () => {
      // Cleanup expired first
      cleanupExpiredDrafts();

      // Fetch server state and sync
      try {
        const response = await fetch('/api/draft/list');
        if (response.ok) {
          const { drafts } = await response.json();
          syncWithServer(drafts);
        }
      } catch (error) {
        console.error('Failed to sync drafts:', error);
      }
    };

    initSync();

    // Periodic cleanup
    syncIntervalRef.current = setInterval(() => {
      cleanupExpiredDrafts();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [session, cleanupExpiredDrafts, syncWithServer]);

  // Watch for new processing drafts and resume them
  useEffect(() => {
    if (!session?.user) return;

    const checkAndResume = async () => {
      const drafts = getActiveDrafts();
      const processingDrafts = drafts.filter(d => d.status === 'processing');

      for (const draft of processingDrafts) {
        // Only resume if not already being processed by this provider
        if (!processingDraftsRef.current.has(draft.id)) {
          processingDraftsRef.current.add(draft.id);
          console.log(`DraftSyncProvider: Resuming processing for ${draft.id}`);

          // Small delay to ensure navigation is complete
          setTimeout(() => {
            resumeProcessing(draft.id).finally(() => {
              // Remove from tracking when done (success or error)
              processingDraftsRef.current.delete(draft.id);
            });
          }, 500);
        }
      }
    };

    // Check immediately
    checkAndResume();

    // Also check periodically for any missed drafts
    const checkInterval = setInterval(checkAndResume, 5000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [session, getActiveDrafts, resumeProcessing]);

  return <>{children}</>;
}
