import type {
  LibraryQuiz,
  QuestionReviewProgress,
  QuestionReviewProgressDraft,
  StreakFreezePurchaseOptions,
  StreakFreezePurchaseResult,
  UserLearningProgress,
} from '@/entities/LearningProgress';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface LibraryQuizListOptions extends RepositoryPaginationOptions {
  folder?: string | null;
}

export interface ReviewProgressMutation {
  questionProgress: QuestionReviewProgressDraft;
  userProgress: UserLearningProgress;
  streakFreezeUsed: boolean;
}

export interface ReviewProgressTransactionResult {
  questionProgress: QuestionReviewProgress;
  userProgress: UserLearningProgress;
  streakFreezeUsed: boolean;
}

export interface ILearningProgressRepository {
  listLibraryQuizzes(
    userId: string,
    options: LibraryQuizListOptions,
  ): Promise<PaginatedRepositoryResult<LibraryQuiz>>;

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

  mutateReviewProgress(
    userId: string,
    quizSlug: string,
    questionId: string,
    mutate: (
      questionProgress: QuestionReviewProgress | null,
      userProgress: UserLearningProgress | null,
    ) => ReviewProgressMutation,
  ): Promise<ReviewProgressTransactionResult>;

  buyStreakFreeze(
    userId: string,
    options: StreakFreezePurchaseOptions,
  ): Promise<StreakFreezePurchaseResult>;
}
