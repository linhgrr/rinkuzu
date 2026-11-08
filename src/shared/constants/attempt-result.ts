/**
 * Attempt result buckets for quiz history (RIN-1197). The pass mark is the one the history
 * "Pass" / "Needs Work" badge uses; the server filter and summary use the same value.
 */
export const ATTEMPT_PASS_MARK = 60;

export const ATTEMPT_RESULT_FILTERS = ['needs_work', 'passed'] as const;

export type AttemptResultFilter = (typeof ATTEMPT_RESULT_FILTERS)[number];
