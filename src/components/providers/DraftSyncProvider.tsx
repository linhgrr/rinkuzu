'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { listQuizDrafts } from '@/lib/quiz/draftApi';
import { mapDraftStatus } from '@/lib/quiz/draftStatus';

const SYNC_INTERVAL = 30000; // 30 seconds

function getProcessingDraftIds(ref: MutableRefObject<Set<string> | null>) {
  if (ref.current === null) {
    ref.current = new Set<string>();
  }

  return ref.current;
}

export function DraftSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Subscribe to each action individually instead of the whole store, so this
  // provider doesn't re-render every time any draft changes.
  const cleanupExpiredDrafts = useDraftStore((s) => s.cleanupExpiredDrafts);
  const syncWithServer = useDraftStore((s) => s.syncWithServer);
  const { resumeProcessing } = usePdfProcessor();
  const processingDraftsRef = useRef<Set<string> | null>(null);

  // Sync server draft state via SWR (dedup + cache + periodic revalidation),
  // replacing the manual fetch + setInterval polling.
  const { data: draftList } = useSWR(
    session?.user ? 'quiz-drafts-sync' : null,
    () => listQuizDrafts(),
    {
      refreshInterval: SYNC_INTERVAL,
      revalidateOnFocus: false,
    },
  );

  // Reconcile the local store whenever fresh server state arrives.
  useEffect(() => {
    if (!draftList) return;
    cleanupExpiredDrafts();
    syncWithServer(
      draftList.flatMap((draft) => {
        const status = mapDraftStatus(draft.status);
        if (!status) return [];
        return [
          {
            id: draft.id,
            title: draft.title,
            status,
            chunksTotal: draft.progress.total,
            chunksProcessed: draft.progress.processed,
            questionsCount: draft.questions.length,
            ...(draft.error !== null && draft.error !== undefined ? { error: draft.error } : {}),
            createdAt: draft.createdAt,
            expiresAt: draft.expiresAt,
          },
        ];
      }),
    );
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
    const resumeTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const checkAndResume = async () => {
      // Read the latest store snapshot on demand instead of subscribing —
      // this value is only used inside the callback.
      const drafts = useDraftStore.getState().getActiveDrafts();
      const processingDrafts = drafts.filter((d) => d.status === 'processing');
      const processingDraftIds = getProcessingDraftIds(processingDraftsRef);

      for (const draft of processingDrafts) {
        // Only resume if not already being processed by this provider
        if (!processingDraftIds.has(draft.id)) {
          processingDraftIds.add(draft.id);
          console.warn(`DraftSyncProvider: Resuming processing for ${draft.id}`);

          // Small delay to ensure navigation is complete
          const resumeTimeout = setTimeout(() => {
            resumeTimeouts.delete(resumeTimeout);
            resumeProcessing(draft.id).finally(() => {
              // Remove from tracking when done (success or error)
              processingDraftIds.delete(draft.id);
            });
          }, 500);
          resumeTimeouts.add(resumeTimeout);
        }
      }
    };

    // Check immediately
    checkAndResume();

    // Also check periodically for any missed drafts
    const checkInterval = setInterval(checkAndResume, 5000);

    return () => {
      clearInterval(checkInterval);
      for (const resumeTimeout of resumeTimeouts) clearTimeout(resumeTimeout);
      resumeTimeouts.clear();
    };
  }, [session, resumeProcessing]);

  return <>{children}</>;
}
