export type StarterQuizLocale = 'vi' | 'en';

/** One stored starter row (RIN-1177), with its own id for admin edits. */
export interface StarterQuizRowRecord {
  id: string;
  quizId: string;
  locale: StarterQuizLocale;
  order: number;
}

export interface StarterQuizInsertInput {
  quizId: string;
  locale: StarterQuizLocale;
  order: number;
  actorId: string;
  /** Re-insert under a known id (undoing an unmark whose audit write failed). */
  id?: string;
}

export interface StarterQuizRowChange {
  id: string;
  locale?: StarterQuizLocale;
  order?: number;
}

/** Admin writes on the starter collection; the read side is IStarterQuizReadRepository. */
export interface IStarterQuizAdminRepository {
  /** Every starter row, sorted by `order`. */
  listStarterQuizRows(): Promise<StarterQuizRowRecord[]>;
  /** Null when the quiz is already a starter (unique key on the quiz id). */
  insertStarterQuiz(input: StarterQuizInsertInput): Promise<StarterQuizRowRecord | null>;
  updateStarterQuizRows(changes: readonly StarterQuizRowChange[], actorId: string): Promise<void>;
  /** False when no row had that id. */
  deleteStarterQuiz(id: string): Promise<boolean>;
}
