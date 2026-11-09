/**
 * Search rules for public quiz pages (RIN-1241, spec sections C10 and D).
 * Pure functions: the quiz page metadata, the sitemap and the subject hub all
 * apply the same rules.
 */

export type QuizContentLocale = 'vi' | 'en';

/** D13: a quiz with fewer questions is too thin to rank (and to land on). */
export const MIN_INDEXABLE_QUESTION_COUNT = 5;

/** C10: the whole `<title>` stays near the width Google shows. */
const SEO_TITLE_MAX_LENGTH = 65;

/** C10: the meta description stays within the snippet Google shows. */
const SEO_DESCRIPTION_MAX_LENGTH = 155;

/** An owner description shorter than this says too little; generate one instead. */
const MIN_OWNER_DESCRIPTION_LENGTH = 50;

/** The quiz title inside a generated description; leaves room for the question. */
const DESCRIPTION_TITLE_MAX_LENGTH = 60;

/**
 * D14 thresholds: letters that only Vietnamese uses. Accents shared with French
 * or Spanish (é, à, ô, ...) do not count, so "Café" or "résumé" never flips an
 * English quiz. In the title one such letter is enough (RIN-1294: "Nhật ngành"
 * has only ậ, and its Japanese questions add no Latin letters). Across the title
 * plus the first questions it takes two, so one stray Vietnamese name in a
 * question (a single letter such as "ễ") does not flip an English quiz; "Chương"
 * alone has ư and ơ, and a Vietnamese question has several.
 */
const MIN_VIETNAMESE_LETTERS_IN_TITLE = 1;
const MIN_VIETNAMESE_LETTERS = 2;

/** Letters with a breve, horn, đ, dot below, hook above, or a stacked tone mark. */
const VIETNAMESE_ONLY_LETTERS = /[ăằắặẳẵầấậẩẫạảđẹẻẽềếệểễịỉĩọỏồốộổỗơờớợởỡụủũưừứựửữỳỵỷỹ]/gu;

/** Any Latin-script letter, with or without diacritics. */
const LATIN_LETTER = /\p{Script=Latin}/u;

export interface QuizIndexabilityInput {
  visibility: string;
  /** False for quizzes of test or company accounts (RIN-840). Server-only. */
  ownerIndexable: boolean;
  questionCount: number;
}

export function isQuizIndexable({
  visibility,
  ownerIndexable,
  questionCount,
}: QuizIndexabilityInput): boolean {
  return visibility === 'public' && ownerIndexable && questionCount >= MIN_INDEXABLE_QUESTION_COUNT;
}

export function detectQuizContentLocale(
  title: string,
  firstQuestionTexts: readonly string[],
): QuizContentLocale {
  const titleLetters = countVietnameseLetters(title);
  if (titleLetters >= MIN_VIETNAMESE_LETTERS_IN_TITLE) return 'vi';
  const questions = firstQuestionTexts.join(' ');
  if (titleLetters + countVietnameseLetters(questions) >= MIN_VIETNAMESE_LETTERS) return 'vi';
  // No Latin text at all (a Japanese-only set such as "情報セキュリティ(1)"): our
  // audience is Vietnamese, so English stays only for Latin text (RIN-1294).
  return LATIN_LETTER.test(`${title} ${questions}`) ? 'en' : 'vi';
}

function countVietnameseLetters(text: string): number {
  return text.normalize('NFC').toLowerCase().match(VIETNAMESE_ONLY_LETTERS)?.length ?? 0;
}

/** Cuts `text` to `maxLength` (ellipsis included), at a word boundary when one is near. */
function shorten(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = cut.lastIndexOf(' ');
  const atWord = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${atWord.replace(/[\s,.;:–-]+$/u, '')}…`;
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Question text without HTML, markdown images, link targets or emphasis marks. */
function toPlainQuestionText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gu, (entity) => HTML_ENTITIES[entity] ?? ' ')
    .replace(/[*_`#>~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function buildQuizSeoTitle(
  title: string,
  questionCount: number,
  locale: QuizContentLocale,
): string {
  const suffix =
    locale === 'vi'
      ? ` – ${questionCount} câu trắc nghiệm có đáp án | RinKuzu`
      : ` – ${questionCount} quiz questions with answers | RinKuzu`;
  return `${shorten(title.trim(), SEO_TITLE_MAX_LENGTH - suffix.length)}${suffix}`;
}

export interface QuizSeoDescriptionInput {
  title: string;
  description?: string | null;
  questionCount: number;
  firstQuestionText?: string | null;
  locale: QuizContentLocale;
}

export function buildQuizSeoDescription({
  title,
  description,
  questionCount,
  firstQuestionText,
  locale,
}: QuizSeoDescriptionInput): string {
  const ownerDescription = description?.trim() ?? '';
  if (ownerDescription.length >= MIN_OWNER_DESCRIPTION_LENGTH) return ownerDescription;

  const shortTitle = shorten(title.trim(), DESCRIPTION_TITLE_MAX_LENGTH);
  const lead =
    locale === 'vi'
      ? `Đề trắc nghiệm ${shortTitle}: ${questionCount} câu hỏi có đáp án và giải thích.`
      : `${shortTitle} quiz: ${questionCount} questions with answers and explanations.`;
  const question = toPlainQuestionText(firstQuestionText ?? '');
  if (!question) return lead;

  const label = locale === 'vi' ? ' Câu 1: ' : ' Q1: ';
  const room = SEO_DESCRIPTION_MAX_LENGTH - lead.length - label.length;
  if (room < 10) return lead;
  return `${lead}${label}${shorten(question, room)}`;
}
