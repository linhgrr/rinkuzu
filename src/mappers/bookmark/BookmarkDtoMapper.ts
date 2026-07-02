import type { BookmarkDto } from '@/dtos/bookmark';
import type { Bookmark } from '@/entities/Bookmark';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class BookmarkDtoMapper {
  static toDto(bookmark: Bookmark): BookmarkDto {
    return {
      id: bookmark.id,
      quiz: {
        slug: bookmark.quiz.slug,
        title: bookmark.quiz.title,
        description: bookmark.quiz.description,
      },
      question: bookmark.question,
      questionIndex: bookmark.questionIndex,
      createdAt: serializeDate(bookmark.createdAt, 'bookmark.createdAt'),
      updatedAt: serializeOptionalDate(bookmark.updatedAt, 'bookmark.updatedAt'),
    };
  }
}
