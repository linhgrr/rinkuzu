export const SRS_RATINGS = ['fail', 'hard', 'good', 'easy'] as const;
export type SRSRating = (typeof SRS_RATINGS)[number];
