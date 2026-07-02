import type {
  LibraryQuiz,
  QuestionReference,
  QuestionReviewProgress,
  QuestionReviewProgressDraft,
  StreakFreezePurchaseOptions,
  StreakFreezePurchaseResult,
  UserLearningProgress,
} from '@/entities/LearningProgress';

export interface ILearningProgressRepository {
  listLibraryQuizzes(userId: string): Promise<LibraryQuiz[]>;

  listDueQuestions(userId: string, now: Date, limit: number): Promise<QuestionReviewProgress[]>;

  findQuestionProgress(
    userId: string,
    quizSlug: string,
    questionId: string,
  ): Promise<QuestionReviewProgress | null>;

  saveQuestionProgress(progress: QuestionReviewProgressDraft): Promise<QuestionReviewProgress>;

  findUserProgress(userId: string): Promise<UserLearningProgress | null>;

  createDefaultUserProgress(userId: string): UserLearningProgress;

  saveUserProgress(progress: UserLearningProgress): Promise<UserLearningProgress>;

  buyStreakFreeze(
    userId: string,
    options: StreakFreezePurchaseOptions,
  ): Promise<StreakFreezePurchaseResult>;

  countLearnedQuestions(userId: string): Promise<number>;

  updateTotalQuestionsLearned(userId: string, totalQuestionsLearned: number): Promise<void>;
}

export interface CreateQuestionProgressData {
  userId: string;
  quizSlug: string;
  questionId: string;
  questionRef?: QuestionReference;
}
