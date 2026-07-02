import type { QuizAttemptResultDto } from '@/dtos/quiz';

export class QuizAttemptDtoMapper {
  static toResultDto(
    attemptId: string,
    score: number,
    correctAnswers: number,
    totalQuestions: number,
  ): QuizAttemptResultDto {
    return {
      attemptId,
      score,
      correctAnswers,
      totalQuestions,
    };
  }
}
