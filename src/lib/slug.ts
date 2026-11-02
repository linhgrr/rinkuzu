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
function slugifyText(text: string): string {
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

const FALLBACK_HEADING_SLUG = 'section';

/**
 * Heading-anchor slugger for one document: slugifies each heading and
 * suffixes repeats (`-2`, `-3`, ...) so every id is unique. Create a fresh
 * one per document; the blog TOC and the rendered headings must each use
 * their own slugger over the same headings in the same order.
 */
export function createHeadingSlugger(): (text: string) => string {
  const used = new Set<string>();
  return (text) => {
    const base = slugifyText(text) || FALLBACK_HEADING_SLUG;
    let id = base;
    for (let n = 2; used.has(id); n += 1) {
      id = `${base}-${n}`;
    }
    used.add(id);
    return id;
  };
}
