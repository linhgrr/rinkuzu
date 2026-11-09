/**
 * Personal-data detector for quiz content (RIN-1336 Part 3, RIN-1338).
 *
 * Pure and synchronous. It returns the kinds found and how many fields hold
 * any of them, never the matched values: callers must not store, log or send
 * the text that matched.
 */

/**
 * Stored flag on a quiz; mirrors `QuizContentFlags` in `@/entities/Quiz`
 * (this client-side module may not import the domain layer). `kinds` holds kind
 * names only, never matched values.
 */
export interface QuizContentFlags {
  personalData: boolean;
  kinds: string[];
  checkedAt: Date;
  clearedBy?: string;
  clearedAt?: Date;
}

const PERSONAL_DATA_KINDS = ['email', 'phone', 'id_number', 'labelled_name'] as const;

type PersonalDataKind = (typeof PERSONAL_DATA_KINDS)[number];

interface PersonalDataDetection {
  kinds: PersonalDataKind[];
  /** Number of input texts holding at least one kind. */
  fieldCount: number;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/u;

/** Digit groups joined by single spaces, dots or dashes; a leading `+` is kept. */
const DIGIT_TOKEN = /\+?\d+(?:[ .-]\d+)*/gu;
const MOBILE = /^(?:84|0)[35789]\d{8}$/u;
const LANDLINE = /^02\d{9}$/u;
const WORD_CHAR = /^[\p{L}\p{N}_]$/u;

/** Operators that make a digit run part of an expression. */
const OPERATOR = String.raw`[=+\-−×*/÷^<>≤≥±%]`;
/**
 * `.` and `,` join a digit run to a longer number (decimal or thousands) only
 * when a digit sits on their other side; otherwise they are punctuation, as in
 * a comma-separated roster of ID numbers or an ID ending a sentence.
 */
const STANDALONE_ID = new RegExp(
  String.raw`(?<!${OPERATOR}\s*)(?<!\d[.,])(?<![\p{L}\p{N}_])(?:\d{12}|\d{9})(?![\p{L}\p{N}_])(?![.,]\d)(?!\s*${OPERATOR})`,
  'u',
);

const ID_LABELS = [
  'MSSV',
  'mã số sinh viên',
  'mã sinh viên',
  'MSV',
  'CCCD',
  'CMND',
  'số định danh',
  'student ID',
  'ID number',
];
const LABELLED_ID = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${ID_LABELS.join('|')})(?![\p{L}])[^\d\n]{0,20}(?<!\d)\d{6,12}(?!\d)`,
  'iu',
);

const NAME_LABELS = ['Họ và tên', 'Họ tên', 'Full name', 'Tên sinh viên', 'Student name'];
const NAME_LABEL = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${NAME_LABELS.join('|')})[ \t]*:[ \t]*`,
  'giu',
);
/** 2 to 5 words that each start with a capital letter. */
const CAPITALISED_WORDS = /^\p{Lu}[\p{L}\p{M}]*(?:[ \t]+\p{Lu}[\p{L}\p{M}]*){1,4}(?![\p{L}\p{M}])/u;

function isPhoneWindow(groups: string[], separators: string[], hasPlus: boolean): boolean {
  for (let start = 0; start < groups.length; start += 1) {
    // A window may only start or end at a space, so a decimal or a longer
    // grouped number never yields a phone from its middle.
    if (start > 0 && separators[start - 1] !== ' ') continue;
    const first = groups[start] ?? '';
    const plusPrefix = start === 0 && hasPlus && first === '84';
    if (first.length < 3 && !plusPrefix) continue;

    let digits = '';
    for (let end = start; end < groups.length; end += 1) {
      digits += groups[end];
      if (digits.length > 12) break;
      const closesAtBoundary = end === groups.length - 1 || separators[end] === ' ';
      if (closesAtBoundary && (MOBILE.test(digits) || LANDLINE.test(digits))) return true;
    }
  }
  return false;
}

function hasPhone(text: string): boolean {
  for (const match of text.matchAll(DIGIT_TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    // Digits glued to a letter (`0912345678x`, `A0912345678`) are a variable or a code.
    if (
      WORD_CHAR.test(text.charAt(start - 1)) ||
      WORD_CHAR.test(text.charAt(start + token.length))
    ) {
      continue;
    }
    const hasPlus = token.startsWith('+');
    const body = hasPlus ? token.slice(1) : token;
    const groups = body.split(/[ .-]/u);
    const separators = body.replace(/\d+/gu, '').split('');
    if (isPhoneWindow(groups, separators, hasPlus)) return true;
  }
  return false;
}

function hasLabelledName(text: string): boolean {
  for (const match of text.matchAll(NAME_LABEL)) {
    const rest = text.slice((match.index ?? 0) + match[0].length);
    if (CAPITALISED_WORDS.test(rest)) return true;
  }
  return false;
}

function detectKinds(text: string): Set<PersonalDataKind> {
  const kinds = new Set<PersonalDataKind>();
  if (EMAIL.test(text)) kinds.add('email');
  if (hasPhone(text)) kinds.add('phone');
  if (STANDALONE_ID.test(text) || LABELLED_ID.test(text)) kinds.add('id_number');
  if (hasLabelledName(text)) kinds.add('labelled_name');
  return kinds;
}

/** @public Table-tested directly; also for the RIN-1341 backfill. */
export function detectPersonalData(texts: readonly string[]): PersonalDataDetection {
  const found = new Set<PersonalDataKind>();
  let fieldCount = 0;

  for (const raw of texts) {
    if (!raw) continue;
    const kinds = detectKinds(raw.normalize('NFC'));
    if (kinds.size === 0) continue;
    fieldCount += 1;
    for (const kind of kinds) found.add(kind);
  }

  return { kinds: PERSONAL_DATA_KINDS.filter((kind) => found.has(kind)), fieldCount };
}

export interface QuizTextSource {
  title: string;
  description?: string | undefined;
  questions: readonly { question: string; options: readonly string[] }[];
}

/**
 * @public Every text a learner sees on the quiz: title, description, question
 * texts and options. Also for the RIN-1341 backfill.
 */
export function collectQuizTexts(quiz: QuizTextSource): string[] {
  const texts = [quiz.title];
  if (quiz.description) texts.push(quiz.description);
  for (const question of quiz.questions) {
    texts.push(question.question, ...question.options);
  }
  return texts;
}

/**
 * Re-checks the quiz texts on save. An admin clear (`clearedBy`/`clearedAt`)
 * stays in force, with the kinds recorded at clear time, until the content
 * holds a kind that was not in those kinds.
 */
export function resolveQuizContentFlags(
  quiz: QuizTextSource,
  previous: QuizContentFlags | undefined,
  now: Date,
): QuizContentFlags {
  const { kinds } = detectPersonalData(collectQuizTexts(quiz));

  if (previous?.clearedBy !== undefined && previous.clearedAt !== undefined) {
    const clearedKinds = new Set(previous.kinds);
    if (kinds.every((kind) => clearedKinds.has(kind))) {
      return {
        personalData: false,
        kinds: [...previous.kinds],
        checkedAt: now,
        clearedBy: previous.clearedBy,
        clearedAt: previous.clearedAt,
      };
    }
  }

  return { personalData: kinds.length > 0, kinds, checkedAt: now };
}
