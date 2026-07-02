import type { QuizAttemptResultDto, QuizDiscussionDto, SavedQuizProgressDto } from '@/dtos/quiz';
import type {
  QuizAttemptResultViewModel,
  QuizDiscussionViewModel,
  SavedQuizProgress,
} from '@/features/quiz/types/quiz-interaction-view-model';

export function toQuizAttemptResultViewModel(
  dto: QuizAttemptResultDto,
): QuizAttemptResultViewModel {
  return {
    score: dto.score,
    correctAnswers: dto.correctAnswers,
    totalQuestions: dto.totalQuestions,
    attemptId: dto.attemptId,
  };
}

export function toSavedQuizProgressViewModel(dto: SavedQuizProgressDto): SavedQuizProgress {
  return {
    questionOrder: dto.questionOrder,
    optionOrders: dto.optionOrders,
    userAnswers: dto.userAnswers,
    currentQuestionIndex: dto.currentQuestionIndex,
    answeredCount: dto.answeredCount,
    totalQuestions: dto.totalQuestions,
  };
}

export function toQuizDiscussionViewModel(dto: QuizDiscussionDto): QuizDiscussionViewModel {
  return {
    id: dto.id,
    questionIndex: dto.questionIndex,
    comments: dto.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      content: comment.content,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
