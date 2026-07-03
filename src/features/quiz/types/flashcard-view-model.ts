export interface FlashcardQuestionViewModel {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface FlashcardQuizViewModel {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions: FlashcardQuestionViewModel[];
}

export interface FlashcardReviewInput {
  quizSlug: string;
  question: FlashcardQuestionViewModel;
  rating: 'good' | 'hard';
}
