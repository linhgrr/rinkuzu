export interface QuizPlayAuthorViewModel {
  id?: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface QuizPlayQuestionViewModel {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface QuizPlayViewModel {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: string | QuizPlayAuthorViewModel | null;
  folder: string | null;
  isPrivate: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
  tags?: string[];
  questions: QuizPlayQuestionViewModel[];
}
