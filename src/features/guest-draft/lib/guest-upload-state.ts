import type { GuestPdfCheck } from '@/features/guest-draft/lib/check-guest-pdf';
import type {
  GuestDraftProgress,
  GuestDraftRefusal,
} from '@/features/guest-draft/types/guest-draft-view-model';

/** Stop waiting after this long and offer a retry (UI spec RIN-1445, section 3). */
export const GUEST_DRAFT_TIMEOUT_MS = 120_000;
/** Consecutive status-check failures before the page gives up and offers a retry. */
export const GUEST_DRAFT_MAX_POLL_ERRORS = 3;

export type GuestUploadPhase =
  | 'idle'
  | 'checking'
  | 'chosen'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'cap';

export type GuestUploadAlert = Exclude<GuestDraftRefusal, 'cap'>;

export interface GuestUploadState {
  phase: GuestUploadPhase;
  file: File | null;
  alert: GuestUploadAlert | null;
  progress: GuestDraftProgress | null;
  token: string | null;
  /** Bumped on every upload: answers of a cancelled or earlier run are ignored. */
  run: number;
  /** Bumped on every status answer, so the poll effect schedules the next one. */
  polls: number;
  pollErrors: number;
  startedAt: number;
}

export type GuestUploadAction =
  | { type: 'check_started'; file: File }
  | { type: 'check_finished'; file: File; result: GuestPdfCheck }
  | { type: 'removed' }
  | { type: 'upload_started'; token: string; now: number }
  | { type: 'upload_refused'; run: number; refusal: GuestDraftRefusal }
  | { type: 'progressed'; run: number; progress: GuestDraftProgress; now: number }
  | { type: 'poll_failed'; run: number; now: number }
  | { type: 'cancelled' };

export const initialGuestUploadState: GuestUploadState = {
  phase: 'idle',
  file: null,
  alert: null,
  progress: null,
  token: null,
  run: 0,
  polls: 0,
  pollErrors: 0,
  startedAt: 0,
};

const isWaiting = (state: GuestUploadState) =>
  state.phase === 'uploading' || state.phase === 'processing';

function settle(state: GuestUploadState, progress: GuestDraftProgress, now: number) {
  const timedOut = now - state.startedAt > GUEST_DRAFT_TIMEOUT_MS;
  const phase: GuestUploadPhase =
    progress.status === 'processing' ? (timedOut ? 'failed' : 'processing') : progress.status;
  return { ...state, phase, progress, pollErrors: 0, polls: state.polls + 1 };
}

function refuse(state: GuestUploadState, refusal: GuestDraftRefusal): GuestUploadState {
  if (refusal === 'cap') return { ...state, phase: 'cap', alert: null };
  // A PDF over the limit or of the wrong type is dropped; any other error keeps it to retry.
  if (refusal === 'upload_error') return { ...state, phase: 'chosen', alert: refusal };
  return { ...state, phase: 'idle', file: null, alert: refusal };
}

function afterCheck(state: GuestUploadState, file: File, result: GuestPdfCheck) {
  if (state.phase !== 'checking' || state.file !== file) return state;
  if (result === 'ok') return { ...state, phase: 'chosen' as const };
  return refuse(state, result);
}

/** The guest upload page as a pure state machine (RIN-1448); the hook runs the effects. */
export function guestUploadReducer(
  state: GuestUploadState,
  action: GuestUploadAction,
): GuestUploadState {
  switch (action.type) {
    case 'check_started':
      return { ...initialGuestUploadState, run: state.run, phase: 'checking', file: action.file };
    case 'check_finished':
      return afterCheck(state, action.file, action.result);
    case 'removed':
      return { ...initialGuestUploadState, run: state.run };
    case 'upload_started':
      return {
        ...state,
        phase: 'uploading',
        alert: null,
        progress: null,
        token: action.token,
        run: state.run + 1,
        pollErrors: 0,
        startedAt: action.now,
      };
    case 'upload_refused':
      return action.run === state.run && state.phase === 'uploading'
        ? refuse(state, action.refusal)
        : state;
    case 'progressed':
      return action.run === state.run && isWaiting(state)
        ? settle(state, action.progress, action.now)
        : state;
    case 'poll_failed': {
      if (action.run !== state.run || state.phase !== 'processing') return state;
      const pollErrors = state.pollErrors + 1;
      const failed =
        pollErrors >= GUEST_DRAFT_MAX_POLL_ERRORS ||
        action.now - state.startedAt > GUEST_DRAFT_TIMEOUT_MS;
      return {
        ...state,
        phase: failed ? 'failed' : 'processing',
        pollErrors,
        polls: state.polls + 1,
      };
    }
    case 'cancelled':
      // Back to the chosen file; a late answer of the cancelled run no longer matches.
      return isWaiting(state)
        ? { ...state, phase: 'chosen', progress: null, token: null, run: state.run + 1 }
        : state;
  }
}
