/** One option of a previewed question, with its letter (A, B, ...). */
export interface QuizLandingPreviewOption {
  letter: string;
  text: string;
  image?: string;
}

/** A previewed question: content only, never an answer or explanation (RIN-1241 C8). */
export interface QuizLandingPreviewQuestion {
  id: string;
  text: string;
  options: QuizLandingPreviewOption[];
  image?: string;
}

export interface QuizLandingRelatedQuiz {
  slug: string;
  title: string;
  questionCount: number;
}

export interface QuizLandingViewModel {
  slug: string;
  title: string;
  description: string;
  authorName: string | null;
  questionCount: number;
  quickRoundEligible: boolean;
  previewQuestions: QuizLandingPreviewQuestion[];
  related: QuizLandingRelatedQuiz[];
}
