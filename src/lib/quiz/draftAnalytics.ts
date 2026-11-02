import { capturePipelineTerminalEventOnce } from '@/lib/analytics/client';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';

type TerminalDraftFields = Pick<QuizDraft, 'id' | 'status' | 'error' | 'createdAt' | 'updatedAt'>;

// Drafts carry only free-text errors, so failures are reduced to a fixed set of
// codes and the raw text never leaves the browser.
function draftErrorCode(draft: TerminalDraftFields): string {
  if (draft.status === 'cancelled') return 'draft_cancelled';
  if (draft.status === 'expired') return 'draft_expired';
  const error = draft.error ?? '';
  if (/\bocr\b/i.test(error)) return 'ocr_failed';
  if (/\btime(d)?[\s-]?out\b/i.test(error)) return 'timeout';
  return 'draft_failed';
}

/**
 * Reports `pipeline_completed` / `pipeline_failed` for a draft this browser saw
 * processing. Non-terminal statuses are ignored, so it is safe to call on every poll.
 */
export function reportQuizDraftTerminal(draft: TerminalDraftFields): void {
  const outcome =
    draft.status === 'completed'
      ? 'completed'
      : draft.status === 'failed' || draft.status === 'cancelled' || draft.status === 'expired'
        ? 'failed'
        : null;
  if (!outcome) return;

  const durationMs = Date.parse(draft.updatedAt) - Date.parse(draft.createdAt);
  capturePipelineTerminalEventOnce({
    path: 'quiz_draft',
    runKey: draft.id,
    outcome,
    errorCode: outcome === 'failed' ? draftErrorCode(draft) : null,
    durationMs,
  });
}
