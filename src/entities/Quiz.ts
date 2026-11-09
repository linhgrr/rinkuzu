export interface QuizAuthorPreview {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

interface QuizQuestionBase {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export type QuizQuestionContent =
  | (QuizQuestionBase & {
      type: 'single';
      correctIndex: number;
      correctIndexes?: never;
    })
  | (QuizQuestionBase & {
      type: 'multiple';
      correctIndex?: never;
      correctIndexes: number[];
    });

export type QuizQuestion = QuizQuestionContent & { id: string };

export type QuizVisibility = 'public' | 'personal';

/**
 * Personal-data check of the quiz texts (RIN-1338). `kinds` holds kind names
 * only, never matched values. An admin clear (`clearedBy`/`clearedAt`) keeps
 * `kinds` as they were at clear time.
 */
export interface QuizContentFlags {
  personalData: boolean;
  kinds: string[];
  checkedAt: Date;
  clearedBy?: string;
  clearedAt?: Date;
}

/** Keeps a public quiz out of the index while a report is open (RIN-1343). */
interface QuizIndexHold {
  reason: 'reported';
  since: Date;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  slug: string;
  /** Former slugs that permanently redirect to `slug`. */
  slugAliases?: string[];
  author: string | QuizAuthorPreview;
  folder?: string | null;
  questions: QuizQuestion[];
  visibility: QuizVisibility;
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
  questionCount?: number;
  contentFlags?: QuizContentFlags;
  indexHold?: QuizIndexHold;
  createdAt: Date;
  updatedAt: Date;
}
