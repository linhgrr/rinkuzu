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

/** A related card's author line (RIN-1469): name and avatar only. */
interface QuizLandingRelatedAuthor {
  name: string | null;
  displayName: string | null;
  avatar: string | null;
}

interface QuizLandingRelatedQuiz {
  slug: string;
  title: string;
  questionCount: number;
  author: QuizLandingRelatedAuthor | null;
}

/** The hub a visitor came from (`?entry=hub&topic=`): the CTAs keep that attribution (RIN-1469). */
interface QuizLandingHubEntry {
  /** A valid topic slug, or null when the link carried none. */
  topic: string | null;
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
  hubEntry: QuizLandingHubEntry | null;
}
