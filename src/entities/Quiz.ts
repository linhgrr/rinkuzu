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

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: string | QuizAuthorPreview;
  folder?: string | null;
  questions: QuizQuestion[];
  isPrivate: boolean;
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
  questionCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
