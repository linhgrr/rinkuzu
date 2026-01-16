// /src/store/useDraftStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunksTotal: number;
  chunksProcessed: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
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
