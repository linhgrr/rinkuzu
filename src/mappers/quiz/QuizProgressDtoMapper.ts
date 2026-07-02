import type {
  DeleteQuizProgressResponseDto,
  QuizProgressResponseDto,
  SaveQuizProgressResponseDto,
} from '@/dtos/quiz';
import type { QuizProgress } from '@/entities/QuizProgress';

export class QuizProgressDtoMapper {
  static toGetResponse(progress: QuizProgress | null): QuizProgressResponseDto {
    return {
      progress: progress
        ? {
            questionOrder: progress.questionOrder,
            optionOrders: progress.optionOrders,
            userAnswers: progress.userAnswers,
            currentQuestionIndex: progress.currentQuestionIndex,
            answeredCount: progress.answeredCount,
            totalQuestions: progress.totalQuestions,
          }
        : null,
    };
  }

  static toSaveResponse(): SaveQuizProgressResponseDto {
    return { saved: true };
  }

  static toDeleteResponse(): DeleteQuizProgressResponseDto {
    return { deleted: true };
  }
}
