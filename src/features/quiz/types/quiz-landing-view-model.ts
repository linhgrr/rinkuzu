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

interface QuizLandingRelatedQuiz {
  slug: string;
  title: string;
  questionCount: number;
}

/** The quiz's topic hub (RIN-1249): the link back under the related block. */
interface QuizLandingTopic {
  name: string;
  /** Locale-prefixed hub path, e.g. `/vi/explore/sinh-hoc`. */
  href: string;
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
  /** True when `related` lists quizzes of the same topic (C12), not recent ones. */
  relatedSameTopic: boolean;
  topic: QuizLandingTopic | null;
}
