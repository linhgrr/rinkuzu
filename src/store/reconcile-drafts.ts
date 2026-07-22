import type { StoreDraftStatus } from '@/lib/quiz/draftStatus';

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | StoreDraftStatus;
  chunksTotal: number;
  chunksProcessed: number;
  chunksError?: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface DraftServerSyncItem {
  id: string;
  title: string;
  status: StoreDraftStatus;
  chunksTotal: number;
  chunksProcessed: number;
  chunksError?: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
  expiresAt?: string;
}

const OPTIMISTIC_DRAFT_GRACE_MS = 60_000;

export function reconcileDraftsWithServer(
  localDrafts: Record<string, DraftProgress>,
  serverDrafts: DraftServerSyncItem[],
  nowMs = Date.now(),
): Record<string, DraftProgress> {
  const serverIds = new Set(serverDrafts.map((draft) => draft.id));
  const activeDrafts = Object.fromEntries(
    Object.entries(localDrafts).filter(([id, draft]) => {
      if (serverIds.has(id)) return true;

      const createdAtMs = new Date(draft.createdAt).getTime();
      const isRecentOptimisticDraft =
        (draft.status === 'uploading' || draft.status === 'processing') &&
        Number.isFinite(createdAtMs) &&
        nowMs - createdAtMs < OPTIMISTIC_DRAFT_GRACE_MS;

      return isRecentOptimisticDraft;
    }),
  );

  for (const serverDraft of serverDrafts) {
    activeDrafts[serverDraft.id] = {
      ...activeDrafts[serverDraft.id],
      ...serverDraft,
    };
  }

  return activeDrafts;
}
