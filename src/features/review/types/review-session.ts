export type ReviewRating = 'fail' | 'hard' | 'good' | 'easy';

export interface ReviewQuestionReferenceViewModel {
  text: string;
  options: string[];
  correctIndexes: number[];
}

export interface ReviewQuestionViewModel {
  id: string;
  quizSlug: string;
  questionId: string;
  questionRef: ReviewQuestionReferenceViewModel;
}

export interface ReviewSubmitResultViewModel {
  xpGained: number;
}

export interface SubmitReviewAnswerInput {
  question: ReviewQuestionViewModel;
  rating: ReviewRating;
}
