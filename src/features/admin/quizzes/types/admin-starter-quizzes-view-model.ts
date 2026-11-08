export type AdminStarterQuizLocale = 'vi' | 'en';

/** Why a starter is hidden from learners; mirrors the API's drop rule (RIN-1177). */
export type AdminStarterQuizDropReason = 'missing' | 'not-public' | 'premium' | 'empty';

export interface AdminStarterQuizViewModel {
  /** The starter row id (PATCH/DELETE). */
  id: string;
  quizId: string;
  /** Null only when the quiz no longer exists. */
  title: string | null;
  questionCount: number;
  locale: AdminStarterQuizLocale;
  /** 1-based position. */
  order: number;
  quick: boolean;
  dropReason: AdminStarterQuizDropReason | null;
}

/** Why a quiz row cannot be marked as a starter, or null when it can. */
export type AdminStarterMarkBlockReason = 'starter' | 'not-public' | 'empty';

export interface AdminStarterQuizMarkInput {
  quizId: string;
  locale: AdminStarterQuizLocale;
  /** 1-based position; omitted means last. */
  order?: number;
}

export interface AdminStarterQuizUpdateInput {
  locale?: AdminStarterQuizLocale;
  order?: number;
}
