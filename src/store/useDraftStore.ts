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
            Object.entries(state.activeDrafts).filter(
              ([_, d]) => d.status !== 'completed'
            )
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
            })
          );
          return { activeDrafts };
        }),

      syncWithServer: (serverDrafts) =>
        set((state) => {
          const serverIds = new Set(serverDrafts.map(d => d._id));

          // Remove drafts that no longer exist on server
          const activeDrafts = Object.fromEntries(
            Object.entries(state.activeDrafts).filter(([id, _]) => {
              return serverIds.has(id);
            })
          );

          // Update status from server for existing drafts
          serverDrafts.forEach(sd => {
            if (activeDrafts[sd._id]) {
              activeDrafts[sd._id] = {
                ...activeDrafts[sd._id],
                status: sd.status as any,
                expiresAt: sd.expiresAt,
              };
            }
          });

          return { activeDrafts };
        }),

      getActiveDrafts: () => Object.values(get().activeDrafts),

      getProcessingCount: () =>
        Object.values(get().activeDrafts).filter(
          (d) => d.status === 'processing' || d.status === 'uploading'
        ).length,

      getCompletedCount: () =>
        Object.values(get().activeDrafts).filter(
          (d) => d.status === 'completed'
        ).length,

      hasActiveDrafts: () => Object.keys(get().activeDrafts).length > 0,
    }),
    {
      name: 'draft-storage',
      version: 1,
    }
  )
);
