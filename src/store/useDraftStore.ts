// /src/store/useDraftStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunksTotal: number;
  chunksProcessed: number;
  chunksError?: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
  expiresAt?: string;
}

const isDraftStatus = (value: string): value is DraftProgress['status'] =>
  value === 'uploading' || value === 'processing' || value === 'completed' || value === 'error';

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
  syncWithServer: (serverDrafts: Array<{ _id: string; status: string; expiresAt: string }>) => void;

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
          const serverIds = new Set(serverDrafts.map((d) => d._id));

          // Remove drafts that no longer exist on server
          const activeDrafts = Object.fromEntries(
            Object.entries(state.activeDrafts).filter(([id, _]) => {
              return serverIds.has(id);
            }),
          );

          // Update status from server for existing drafts
          serverDrafts.forEach((sd) => {
            if (activeDrafts[sd._id] && isDraftStatus(sd.status)) {
              activeDrafts[sd._id] = {
                ...activeDrafts[sd._id],
                status: sd.status,
                expiresAt: sd.expiresAt,
              };
            }
          });

          return { activeDrafts };
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
      version: 2,
      // v1 -> v2 migration: post-US-507 the BE owns Mode A drafts and reports
      // flat progress only (no per-chunk detail). Collapse any persisted
      // multi-chunk progress to a single-step shape so the UI stays
      // consistent at cutover.
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return { activeDrafts: {} } as { activeDrafts: Record<string, DraftProgress> };
        }
        if (version >= 2) return persistedState as { activeDrafts: Record<string, DraftProgress> };

        const state = persistedState as { activeDrafts?: Record<string, DraftProgress> };
        const drafts = state.activeDrafts ?? {};
        const migrated: Record<string, DraftProgress> = {};

        for (const [id, draft] of Object.entries(drafts)) {
          const isComplete = draft.status === 'completed';
          migrated[id] = {
            ...draft,
            chunksTotal: 1,
            chunksProcessed: isComplete ? 1 : 0,
            chunksError: draft.status === 'error' ? 1 : 0,
          };
        }

        return { activeDrafts: migrated };
      },
    },
  ),
);
