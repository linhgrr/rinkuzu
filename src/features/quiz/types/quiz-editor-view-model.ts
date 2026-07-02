export interface QuizEditorAuthorViewModel {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export type QuizEditorQuestionViewModel =
  | {
      id?: string;
      editorId: string;
      question: string;
      options: string[];
      type: 'single';
      correctIndex: number;
      questionImage?: string;
      optionImages?: (string | undefined)[];
    }
  | {
      id?: string;
      editorId: string;
      question: string;
      options: string[];
      type: 'multiple';
      correctIndexes: number[];
      questionImage?: string;
      optionImages?: (string | undefined)[];
    };

type QuizEditorQuestionInput<T extends QuizEditorQuestionViewModel> = Omit<T, 'id' | 'editorId'>;

export type QuizEditorQuestionInputViewModel = QuizEditorQuestionViewModel extends infer Question
  ? Question extends QuizEditorQuestionViewModel
    ? QuizEditorQuestionInput<Question>
    : never
  : never;

export interface QuizEditViewModel {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: QuizEditorAuthorViewModel | null;
  folder: string | null;
  isPrivate: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
  tags?: string[];
  questions: QuizEditorQuestionViewModel[];
}

export interface UpdateQuizEditInput {
  title: string;
  description: string;
  folder: string | null;
  questions: QuizEditorQuestionInputViewModel[];
  isPrivate: boolean;
}
