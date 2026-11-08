import type { Locale } from '@/i18n/config';

/**
 * Letters only Vietnamese uses among the supported locales: ă đ ơ ư and the
 * tone-marked vowels of the Latin Extended Additional block (U+1EA0–U+1EF9).
 * â ê ô and plain acute/grave accents are left out because French and other
 * Latin languages share them.
 */
const VIETNAMESE_LETTERS = /[ăđơưĂĐƠƯ\u1EA0-\u1EF9]/u;

/**
 * The language of user-written content (a quiz title, a description), or null
 * when it cannot be told. Callers keep every locale for null (RIN-1265).
 */
export function detectContentLocale(
  ...texts: ReadonlyArray<string | null | undefined>
): Locale | null {
  const isVietnamese = texts.some(
    (text) => typeof text === 'string' && VIETNAMESE_LETTERS.test(text.normalize('NFC')),
  );
  return isVietnamese ? 'vi' : null;
}
