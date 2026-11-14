/**
 * Pasted-text quiz source (RIN-1536), for guests and signed-in learners alike. Counted in
 * Unicode code points after trimming, as the API counts them; the API enforces it too.
 */
export const QUIZ_TEXT_MIN_CHARS = 200;
export const QUIZ_TEXT_MAX_CHARS = 20_000;

/** Refusal reasons the text-draft routes send (`guest_`-prefixed on the guest route). */
export const QUIZ_TEXT_TOO_SHORT = 'text_too_short';
export const QUIZ_TEXT_TOO_LONG = 'text_too_long';

/** Code points, so an emoji counts once here as it does in the API's `len()`. */
export function countQuizTextChars(text: string): number {
  return Array.from(text.trim()).length;
}
