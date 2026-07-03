export type SRSRating = 'fail' | 'hard' | 'good' | 'easy';

export interface SRSReviewResult {
  /** Days until the next review. */
  interval: number;
  /** Updated SuperMemo-2 ease factor. */
  easeFactor: number;
  nextReviewDate: Date;
  /** Derived level for UI display, from 0 to 5. */
  srsLevel: number;
}
