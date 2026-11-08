import type { ApiErrorKind } from '@/lib/api/error-kind';
import type {
  PremiumAnswerViewModel,
  PremiumBatchViewModel,
} from '@/features/quiz/api/premium-quiz-api';

/** Everything the premium player shows; one reducer so related fields move together (RIN-1193). */
export interface PremiumPlayerState {
  batches: Record<number, PremiumBatchViewModel>;
  currentIndex: number;
  answers: Array<PremiumAnswerViewModel | null>;
  sessionId: string;
  watermark: string;
  /** Start, unlock or submit is in flight. */
  loading: boolean;
  unlockRequired: boolean;
  /** A 401 at any step means the session is gone (RIN-747): ask to sign in again. */
  signInRequired: boolean;
  /** Localized inline copy for a failed save, unlock or submit (RIN-753). */
  error: string;
  /** A failed start replaces the whole player with the page-level ErrorState. */
  loadError: unknown;
}

export type PremiumPlayerAction =
  | { type: 'startRequested' }
  | { type: 'sessionStarted'; batch: PremiumBatchViewModel }
  | { type: 'startFailed'; kind: ApiErrorKind; error: unknown }
  | { type: 'actionRequested'; clearError: boolean }
  | { type: 'actionFailed'; message: string }
  | { type: 'settled' }
  | { type: 'signInRequired' }
  | { type: 'batchLoaded'; batch: PremiumBatchViewModel }
  | { type: 'answerChosen'; index: number; answer: PremiumAnswerViewModel }
  | { type: 'moved'; index: number };

export const initialPremiumPlayerState: PremiumPlayerState = {
  batches: {},
  currentIndex: 0,
  answers: [],
  sessionId: '',
  watermark: '',
  loading: true,
  unlockRequired: false,
  signInRequired: false,
  error: '',
  loadError: null,
};

// 401 asks to sign in (RIN-747), unlock_required offers the unlock; the rest is a page error.
function failStart(state: PremiumPlayerState, kind: ApiErrorKind, error: unknown) {
  if (kind === 'aborted') return state;
  if (kind === 'auth_required') return { ...state, signInRequired: true };
  if (kind === 'unlock_required') return { ...state, unlockRequired: true };
  return { ...state, loadError: error };
}

export function premiumPlayerReducer(
  state: PremiumPlayerState,
  action: PremiumPlayerAction,
): PremiumPlayerState {
  switch (action.type) {
    case 'startRequested':
      return { ...state, loading: true, error: '', loadError: null };
    case 'sessionStarted': {
      const { batch } = action;
      return {
        ...state,
        batches: { [batch.batchIndex]: batch },
        currentIndex: batch.currentQuestionIndex,
        answers: batch.answers,
        sessionId: batch.sessionId,
        watermark: batch.watermark,
        unlockRequired: false,
        error: '',
      };
    }
    case 'startFailed':
      return failStart(state, action.kind, action.error);
    case 'actionRequested':
      return { ...state, loading: true, ...(action.clearError && { error: '' }) };
    case 'actionFailed':
      return { ...state, error: action.message };
    case 'settled':
      return { ...state, loading: false };
    case 'signInRequired':
      return { ...state, signInRequired: true };
    case 'batchLoaded':
      return {
        ...state,
        batches: { ...state.batches, [action.batch.batchIndex]: action.batch },
        watermark: action.batch.watermark,
      };
    case 'answerChosen': {
      const answers = [...state.answers];
      answers[action.index] = action.answer;
      return { ...state, answers };
    }
    case 'moved':
      return { ...state, currentIndex: action.index };
  }
}
