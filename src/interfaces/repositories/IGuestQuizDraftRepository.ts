import type { QuizQuestion } from '@/entities/Quiz';
import type { GuestDraftEntry, GuestDraftStatus } from '@/shared/constants/guest-draft';

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
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  failureReason: string | null;
}

export interface NewGuestDraft {
  tokenHash: string;
  apiDraftId: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  expiresAt: Date;
}

export interface GuestDraftReadyUpdate {
  title: string;
  questions: GuestDraftQuestion[];
}

/** Guest drafts live in their own collection, never in `Quiz` (RIN-1446). */
export interface IGuestQuizDraftRepository {
  create(draft: NewGuestDraft): Promise<GuestDraftRecord>;
  findByTokenHash(tokenHash: string): Promise<GuestDraftRecord | null>;
  /** Moves a processing draft to ready; false when another poll got there first. */
  markReady(id: string, update: GuestDraftReadyUpdate): Promise<boolean>;
  /** Moves a processing draft to failed; false when it was no longer processing. */
  markFailed(id: string, failureReason: string): Promise<boolean>;
}

/** A ready guest draft as a playable quiz; the questions keep their correct answers. */
export interface GuestDraftQuiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

/** Read side of a ready guest draft, for play and the server-side scored attempt. */
export interface IGuestDraftQuizSource {
  /** Only a `ready` draft; null for an unknown, processing, failed or expired one. */
  findReadyByTokenHash(tokenHash: string): Promise<GuestDraftQuiz | null>;
}
