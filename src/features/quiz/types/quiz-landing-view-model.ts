/** A previewed question: content only, never an answer or explanation (RIN-1241 C8). */
export interface QuizLandingPreviewQuestion {
  text: string;
  options: string[];
  image?: string;
  /** One entry per option; null where the option has no image. */
  optionImages?: (string | null)[];
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
