import connectDB from '@/lib/mongoose';
import Bookmark from '@/models/Bookmark';
import { buildPaginationMeta } from '@/lib/pagination';
import type { Bookmark as BookmarkEntity } from '@/entities/Bookmark';
import {
  IBookmarkRepository,
  type CreateBookmarkData,
} from '@/interfaces/repositories/IBookmarkRepository';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import { BookmarkPersistenceMapper } from '@/repositories/mappers/BookmarkPersistenceMapper';
import type { BookmarkPersistenceRecord } from '@/repositories/types/BookmarkPersistence';

export class BookmarkRepository implements IBookmarkRepository {
  async findByUserEmail(
    userEmail: string,
    options?: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<BookmarkEntity>> {
    await connectDB();

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const [records, totalItems] = await Promise.all([
      Bookmark.find({ userEmail })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<BookmarkPersistenceRecord[]>(),
      Bookmark.countDocuments({ userEmail }),
    ]);

    return {
      items: records.map(BookmarkPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findByUserAndQuiz(
    userEmail: string,
    quizSlug: string,
    questionIndex: number,
  ): Promise<BookmarkEntity | null> {
    await connectDB();
    const record = await Bookmark.findOne({
      userEmail,
      'quiz.slug': quizSlug,
      questionIndex,
    }).lean<BookmarkPersistenceRecord>();
    return record ? BookmarkPersistenceMapper.toEntity(record) : null;
  }

  async create(bookmarkData: CreateBookmarkData): Promise<BookmarkEntity> {
    await connectDB();
    const document = await Bookmark.create(bookmarkData);
    const record: BookmarkPersistenceRecord = document.toObject();
    return BookmarkPersistenceMapper.toEntity(record);
  }

  async deleteByIdAndUser(id: string, userEmail: string): Promise<boolean> {
    await connectDB();
    const result = await Bookmark.findOneAndDelete({
      _id: id,
      userEmail,
    });
    return !!result;
  }
}
