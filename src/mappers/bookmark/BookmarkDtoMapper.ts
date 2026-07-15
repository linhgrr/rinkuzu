import type { BookmarkDto } from '@/dtos/bookmark';
import type { Bookmark } from '@/entities/Bookmark';
import { serializeDate } from '@/lib/date-serialization';

export class BookmarkDtoMapper {
  static toDto(bookmark: Bookmark): BookmarkDto {
    return {
      id: bookmark.id,
      quiz: {
        slug: bookmark.quiz.slug,
        title: bookmark.quiz.title,
        ...(bookmark.quiz.description !== undefined && {
          description: bookmark.quiz.description,
        }),
      },
      question: bookmark.question,
      questionIndex: bookmark.questionIndex,
      createdAt: serializeDate(bookmark.createdAt, 'bookmark.createdAt'),
      updatedAt: serializeDate(bookmark.updatedAt, 'bookmark.updatedAt'),
    };
  }
}
