//
// Holds a single PDF File picked on the dashboard drop zone so the /create
// page can pick it up after navigation. Not persisted: a File object cannot
// be serialized to storage, and the hand-off is meant to live only for the
// dashboard → /create transition.
import { create } from 'zustand';

interface PendingQuizUploadStore {
  file: File | null;
  setFile: (file: File | null) => void;
  consumeFile: () => File | null;
}

export const usePendingQuizUploadStore = create<PendingQuizUploadStore>((set, get) => ({
  file: null,
  setFile: (file) => set({ file }),
  consumeFile: () => {
    const { file } = get();
    if (file) {
      set({ file: null });
    }
    return file;
  },
}));
