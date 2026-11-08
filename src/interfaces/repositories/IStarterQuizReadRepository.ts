/** One admin-curated starter row (RIN-1177), in display order. */
export interface StarterQuizEntryRecord {
  quizId: string;
  locale: string;
  order: number;
}

/** What eligibility needs to know about a starter's quiz; question bodies never leave the DB. */
export interface StarterQuizCandidateRecord {
  quizId: string;
  slug: string;
  title: string;
  visibility: string;
  questionCount: number;
  isPremium: boolean;
}

export interface IStarterQuizReadRepository {
  /** Every starter row, sorted by `order`. */
  listStarterQuizEntries(): Promise<StarterQuizEntryRecord[]>;
  findStarterQuizCandidates(quizIds: string[]): Promise<StarterQuizCandidateRecord[]>;
}
