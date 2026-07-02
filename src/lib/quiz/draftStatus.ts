import type { components } from '@/generated/adaptive-api';

type AdaptiveSchemas = components['schemas'];

export type QuizDraftStatus = AdaptiveSchemas['QuizDraftResponseData']['status'];
export type StoreDraftStatus = 'processing' | 'completed' | 'error';

// Collapse the FastAPI draft status set onto the store vocabulary.
// `submitted` maps to null: the draft is already published, so the UI drops it
// from local progress sync.
export function mapDraftStatus(status: QuizDraftStatus): StoreDraftStatus | null {
  switch (status) {
    case 'queued':
    case 'processing':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'error';
    case 'submitted':
      return null;
  }
}
