import type { QuizQuestion } from '@/entities/Quiz';
import type {
  GuestDraftCompletion,
  GuestDraftEntry,
  GuestDraftFileType,
  GuestDraftSource,
  GuestDraftStatus,
} from '@/shared/constants/guest-draft';

/** A question copied from the API draft; correct answers stay on the server. */
export type GuestDraftQuestion =
  | {
      question: string;
      options: string[];
      type: 'single';
      correctIndex: number;
      questionImage?: string;
    }
  | {
      question: string;
      options: string[];
      type: 'multiple';
      correctIndexes: number[];
      questionImage?: string;
    };

export interface GuestDraftRecord {
  id: string;
  apiDraftId: string;
  status: GuestDraftStatus;
  title: string | null;
  questionCount: number;
  /**
   * False while a ready draft is playable with its first batch and the API still extracts
   * the rest (RIN-1619); true for a complete ready draft. False for processing and failed.
   */
  complete: boolean;
  /** How a complete ready draft ended; null until then. */
  completion: GuestDraftCompletion | null;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  source: GuestDraftSource;
  /** Set on a text draft made from a Word or PowerPoint file (RIN-1786). */
  sourceFileType?: GuestDraftFileType | undefined;
  failureReason: string | null;
  createdAt: Date;
}

export interface NewGuestDraft {
  tokenHash: string;
  apiDraftId: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  source: GuestDraftSource;
  /** Set on a text draft made from a Word or PowerPoint file (RIN-1786). */
  sourceFileType?: GuestDraftFileType | undefined;
  expiresAt: Date;
}

export interface GuestDraftReadyUpdate {
  title: string;
  questions: GuestDraftQuestion[];
  /** Omitted: `full`. */
  completion?: GuestDraftCompletion;
}

/** Completes a ready draft that held only its first batch (RIN-1619). */
export interface GuestDraftCompleteUpdate {
  /** How many questions the poll saw stored: the append is guarded on it. */
  storedCount: number;
  /** Appended after the stored ones, in order; empty when the rest never came. */
  questions: GuestDraftQuestion[];
  /** Omitted: the stored (fallback) title stays. */
  title?: string;
  completion: GuestDraftCompletion;
}

/** Guest drafts live in their own collection, never in `Quiz` (RIN-1446). */
export interface IGuestQuizDraftRepository {
  create(draft: NewGuestDraft): Promise<GuestDraftRecord>;
  findByTokenHash(tokenHash: string): Promise<GuestDraftRecord | null>;
  /** Moves a processing draft to ready and complete; false when another poll got there first. */
  markReady(id: string, update: GuestDraftReadyUpdate): Promise<boolean>;
  /**
   * Moves a processing draft to ready but incomplete with its first batch (RIN-1619); false
   * when another poll got there first.
   */
  storeFirstBatch(id: string, update: GuestDraftReadyUpdate): Promise<boolean>;
  /**
   * Appends the rest to an incomplete draft that still holds exactly `storedCount`
   * questions and marks it complete; false when another poll got there first, so two
   * concurrent polls never append twice.
   */
  completeDraft(id: string, update: GuestDraftCompleteUpdate): Promise<boolean>;
  /** Moves a processing draft to failed; false when it was no longer processing. */
  markFailed(id: string, failureReason: string): Promise<boolean>;
}

/** A ready, unexpired guest draft with what the claim copies into a `Quiz` (RIN-1447). */
export interface ClaimableGuestDraft {
  id: string;
  apiDraftId: string;
  title: string;
  questions: GuestDraftQuestion[];
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  source: GuestDraftSource;
  /** Set on a text draft made from a Word or PowerPoint file (RIN-1786). */
  sourceFileType?: GuestDraftFileType | undefined;
  /** False while the API still extracts the rest (RIN-1619). */
  complete: boolean;
}

/** The claim side of the guest draft store; never logs or returns a hash. */
export interface IGuestDraftClaimRepository {
  findClaimable(tokenHashes: readonly string[], now: Date): Promise<ClaimableGuestDraft[]>;
  /** True only for the call that removed it, so a second tab sends no second event. */
  deleteClaimed(id: string): Promise<boolean>;
}

/** A ready guest draft as a playable quiz; the questions keep their correct answers. */
export interface GuestDraftQuiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  /** False while only the first batch is stored (RIN-1619). */
  complete: boolean;
  /** How a complete draft ended; null while incomplete. */
  completion: GuestDraftCompletion | null;
}

/** Read side of a ready guest draft, for play and the server-side scored attempt. */
export interface IGuestDraftQuizSource {
  /**
   * Only a `ready` draft, complete or holding its first batch (RIN-1619); null for an
   * unknown, processing, failed or expired one.
   */
  findReadyByTokenHash(tokenHash: string): Promise<GuestDraftQuiz | null>;
}
