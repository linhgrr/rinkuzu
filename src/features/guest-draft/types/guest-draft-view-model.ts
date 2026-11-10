import type { GuestDraftStatus } from '@/shared/constants/guest-draft';

/** Progress of a guest draft as the upload page shows it (RIN-1448). */
export interface GuestDraftProgress {
  status: GuestDraftStatus;
  /** 0-100. */
  percent: number;
  questionCount: number;
  title: string | null;
}

/** What the upload page shows when the browser or the server refuses a PDF. */
export type GuestDraftRefusal = 'too_large' | 'not_pdf' | 'cap' | 'upload_error';
