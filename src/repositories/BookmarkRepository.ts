import connectDB from '@/lib/mongoose';
import Bookmark from '@/models/Bookmark';
import { buildPaginationMeta } from '@/lib/pagination';
import type { Bookmark as BookmarkEntity } from '@/entities/Bookmark';
import {
  type BookmarkListOptions,
  type BookmarkQuizCounts,
  IBookmarkRepository,
  type CreateBookmarkData,
} from '@/interfaces/repositories/IBookmarkRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import { BookmarkPersistenceMapper } from '@/repositories/mappers/BookmarkPersistenceMapper';
import type { BookmarkPersistenceRecord } from '@/repositories/types/BookmarkPersistence';

interface BookmarkListAggregateMeta {
  totalItems: number;
}

interface BookmarkListAggregateResult {
  items: BookmarkPersistenceRecord[];
  meta: BookmarkListAggregateMeta[];
}

interface BookmarkQuizGroup {
  _id: string;
  title: string;
  count: number;
}

interface BookmarkQuizTotal {
  total: number;
}

interface BookmarkQuizCountAggregateResult {
  quizzes: BookmarkQuizGroup[];
  total: BookmarkQuizTotal[];
}

export class BookmarkRepository implements IBookmarkRepository {
  async findByUserId(
    userId: string,
    options: BookmarkListOptions,
  ): Promise<PaginatedRepositoryResult<BookmarkEntity>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const filter = options.quizSlug ? { userId, 'quiz.slug': options.quizSlug } : { userId };

    const [result] = await Bookmark.aggregate<BookmarkListAggregateResult>([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ]);
    const records = result?.items ?? [];
    const totalItems = result?.meta[0]?.totalItems ?? 0;

    return {
      items: records.map(BookmarkPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  /**
   * Groups the user's bookmarks by quiz slug. `$match` + `$sort` walk the
   * `{ userId, quiz.slug, createdAt }` index, so the title is the latest saved one;
   * cost grows with that user's bookmarks only.
   */
  async countByQuiz(userId: string, limit: number): Promise<BookmarkQuizCounts> {
    await connectDB();

    const [result] = await Bookmark.aggregate<BookmarkQuizCountAggregateResult>([
      { $match: { userId } },
      { $sort: { 'quiz.slug': 1, createdAt: -1 } },
      {
        $group: {
          _id: '$quiz.slug',
          title: { $first: '$quiz.title' },
          count: { $sum: 1 },
        },
      },
      {
        $facet: {
          quizzes: [{ $sort: { count: -1, _id: 1 } }, { $limit: limit }],
          total: [{ $group: { _id: null, total: { $sum: '$count' } } }],
        },
      },
    ]);

    return {
      quizzes: (result?.quizzes ?? []).map((group) => ({
        slug: group._id,
        title: group.title,
        count: group.count,
      })),
      total: result?.total[0]?.total ?? 0,
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
