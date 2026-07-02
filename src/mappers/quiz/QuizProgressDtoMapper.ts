import type { DeleteQuizProgressResponseDto, SaveQuizProgressResponseDto } from '@/dtos/quiz';

export class QuizProgressDtoMapper {
  static toSaveResponse(): SaveQuizProgressResponseDto {
    return { saved: true };
  }

  static toDeleteResponse(): DeleteQuizProgressResponseDto {
    return { deleted: true };
  }
}
