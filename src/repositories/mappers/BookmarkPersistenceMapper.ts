import type { Bookmark } from '@/entities/Bookmark';
import { serializeId } from '@/lib/mongo-id';
import type { BookmarkPersistenceRecord } from '@/repositories/types/BookmarkPersistence';

export class BookmarkPersistenceMapper {
  static toEntity(record: BookmarkPersistenceRecord): Bookmark {
    return {
      id: serializeId(record._id, 'bookmark._id'),
      userId: record.userId,
      userEmail: record.userEmail,
      quiz: {
        slug: record.quiz.slug,
        title: record.quiz.title,
        description: record.quiz.description,
      },
      question: {
        text: record.question.text,
        options: record.question.options,
        type: record.question.type,
        correctIndex: record.question.correctIndex,
        correctIndexes: record.question.correctIndexes,
        questionImage: record.question.questionImage,
        optionImages: record.question.optionImages,
      },
      questionIndex: record.questionIndex,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
