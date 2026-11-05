/**
 * Quick round (RIN-933): a learner plays a 10-question subset of a long quiz as a normal attempt.
 * Shared by the submit contract (server) and the player (client).
 */
export const QUICK_ROUND_SIZE = 10;

/** A quiz needs strictly more questions than this to offer a quick round. */
export const QUICK_ROUND_MIN_QUIZ_SIZE = 15;

export function isQuickRoundEligible(questionCount: number): boolean {
  return questionCount > QUICK_ROUND_MIN_QUIZ_SIZE;
}
