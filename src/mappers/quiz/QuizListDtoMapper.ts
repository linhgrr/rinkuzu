import type { Quiz } from '@/entities/Quiz';
import type { QuizListItemDto } from '@/dtos/quiz';
import { serializeDate } from '@/lib/date-serialization';
import { toQuizAuthorDto } from '@/mappers/quiz/QuizAuthorDtoMapper';

export class QuizListDtoMapper {
  static toListItem(quiz: Quiz): QuizListItemDto {
    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      author: toQuizAuthorDto(quiz.author),
      folder: quiz.folder ?? null,
      visibility: quiz.visibility,
      questionCount: quiz.questionCount ?? quiz.questions.length,
      createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
      updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
      ...(quiz.description === undefined ? {} : { description: quiz.description }),
    };
  }
}
