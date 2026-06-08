// src/components/providers/DraftSyncProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { fetchApiData } from '@/lib/api/client';

const SYNC_INTERVAL = 30000; // 30 seconds

type DraftListResponse = {
  drafts: Array<{ _id: string; status: string; expiresAt: string }>;
};

export function DraftSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Subscribe to each action individually instead of the whole store, so this
  // provider doesn't re-render every time any draft changes.
  const cleanupExpiredDrafts = useDraftStore((s) => s.cleanupExpiredDrafts);
  const syncWithServer = useDraftStore((s) => s.syncWithServer);
  const { resumeProcessing } = usePdfProcessor();
  const processingDraftsRef = useRef<Set<string>>(new Set());

  // Sync server draft state via SWR (dedup + cache + periodic revalidation),
  // replacing the manual fetch + setInterval polling.
  const { data: draftList } = useSWR<DraftListResponse>(
    session?.user ? '/api/draft/list' : null,
    (url: string) => fetchApiData<DraftListResponse>(url),
    {
      refreshInterval: SYNC_INTERVAL,
      revalidateOnFocus: false,
    },
  );

  // Reconcile the local store whenever fresh server state arrives.
  useEffect(() => {
    if (!draftList) return;
    cleanupExpiredDrafts();
    syncWithServer(draftList.drafts);
  }, [draftList, cleanupExpiredDrafts, syncWithServer]);

  // Periodic local cleanup of expired drafts, independent of network state.
  useEffect(() => {
    if (!session?.user) return;
    const id = setInterval(() => cleanupExpiredDrafts(), SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [session, cleanupExpiredDrafts]);

  // Watch for new processing drafts and resume them
  useEffect(() => {
    if (!session?.user) return;

    const checkAndResume = async () => {
      // Read the latest store snapshot on demand instead of subscribing —
      // this value is only used inside the callback.
      const drafts = useDraftStore.getState().getActiveDrafts();
      const processingDrafts = drafts.filter((d) => d.status === 'processing');

      for (const draft of processingDrafts) {
        // Only resume if not already being processed by this provider
        if (!processingDraftsRef.current.has(draft.id)) {
          processingDraftsRef.current.add(draft.id);
          console.warn(`DraftSyncProvider: Resuming processing for ${draft.id}`);

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
  }, [session, resumeProcessing]);

  return <>{children}</>;
}
