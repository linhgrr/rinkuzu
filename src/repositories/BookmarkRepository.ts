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
  async findByUserId(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<BookmarkEntity>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [records, totalItems] = await Promise.all([
      Bookmark.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<BookmarkPersistenceRecord[]>(),
      Bookmark.countDocuments({ userId }),
    ]);

    return {
      items: records.map(BookmarkPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async create(bookmarkData: CreateBookmarkData): Promise<BookmarkEntity> {
    await connectDB();
    const document = await Bookmark.create(bookmarkData);
    const record: BookmarkPersistenceRecord = document.toObject();
    return BookmarkPersistenceMapper.toEntity(record);
  }

  async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
    await connectDB();
    const result = await Bookmark.findOneAndDelete({
      _id: id,
      userId,
    });
    return !!result;
  }
}
