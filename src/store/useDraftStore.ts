import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  expiresAt: string;
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

interface DraftStore {
  activeDrafts: Record<string, DraftProgress>;

  // Actions
  addDraft: (draft: DraftProgress) => void;
  updateDraftProgress: (id: string, updates: Partial<DraftProgress>) => void;
  completeDraft: (id: string, questionsCount: number) => void;
  setDraftError: (id: string, error: string) => void;
  removeDraft: (id: string) => void;
  clearCompletedDrafts: () => void;
  cleanupExpiredDrafts: () => void;
  syncWithServer: (serverDrafts: DraftServerSyncItem[]) => void;

  // Computed helpers
  getActiveDrafts: () => DraftProgress[];
  getProcessingCount: () => number;
  getCompletedCount: () => number;
  hasActiveDrafts: () => boolean;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      activeDrafts: {},

      addDraft: (draft) =>
        set((state) => ({
          activeDrafts: { ...state.activeDrafts, [draft.id]: draft },
        })),

      updateDraftProgress: (id, updates) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: { ...state.activeDrafts[id], ...updates },
            },
          };
        }),

      completeDraft: (id, questionsCount) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: {
                ...state.activeDrafts[id],
                status: 'completed',
                questionsCount,
              },
            },
          };
        }),

      setDraftError: (id, error) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: {
                ...state.activeDrafts[id],
                status: 'error',
                error,
              },
            },
          };
        }),

      removeDraft: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.activeDrafts;
          return { activeDrafts: rest };
        }),

      clearCompletedDrafts: () =>
        set((state) => {
          const activeDrafts = Object.fromEntries(
            Object.entries(state.activeDrafts).filter(([_, d]) => d.status !== 'completed'),
          );
          return { activeDrafts };
        }),

      cleanupExpiredDrafts: () =>
        set((state) => {
          const now = new Date();
          const activeDrafts = Object.fromEntries(
            Object.entries(state.activeDrafts).filter(([_, d]) => {
              if (!d.expiresAt) return true; // Keep if no expiry
              return new Date(d.expiresAt) > now;
            }),
          );
          return { activeDrafts };
        }),

      syncWithServer: (serverDrafts) =>
        set((state) => {
          return {
            activeDrafts: reconcileDraftsWithServer(state.activeDrafts, serverDrafts),
          };
        }),

      getActiveDrafts: () => Object.values(get().activeDrafts),

      getProcessingCount: () =>
        Object.values(get().activeDrafts).filter(
          (d) => d.status === 'processing' || d.status === 'uploading',
        ).length,

      getCompletedCount: () =>
        Object.values(get().activeDrafts).filter((d) => d.status === 'completed').length,

      hasActiveDrafts: () => Object.keys(get().activeDrafts).length > 0,
    }),
    {
      name: 'draft-storage',
    },
  ),
);
