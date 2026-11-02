const COMBINING_MARKS = /[\u0300-\u036f]/g;
const APOSTROPHES = /['\u2019]/g;
const NON_ALPHANUMERIC_RUN = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/**
 * Turn free text into a URL/anchor-safe slug, transliterating Vietnamese
 * (and other Latin diacritics) instead of dropping the letters.
 *
 * "Chương 3: Data Structures" -> "chuong-3-data-structures"
 * Apostrophes are dropped rather than split on ("Bloom's" -> "blooms") so
 * ordinary English text keeps the slug it had before this helper existed.
 * Returns '' when nothing slug-worthy remains (emoji, punctuation, blanks).
 */
export function slugifyText(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(NON_ALPHANUMERIC_RUN, '-')
    .replace(EDGE_DASHES, '');
}

const FALLBACK_QUIZ_SLUG = 'quiz';

/** Quiz slug: readable base plus the last 6 digits of Date.now(). */
export function generateSlug(title: string): string {
  const base = slugifyText(title) || FALLBACK_QUIZ_SLUG;
  return `${base}-${Date.now().toString().slice(-6)}`;
}
