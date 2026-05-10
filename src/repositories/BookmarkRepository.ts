import connectDB from '@/lib/mongoose';
import Bookmark from '@/models/Bookmark';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { IBookmark, IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository';

export class BookmarkRepository extends BaseRepository<IBookmark> implements IBookmarkRepository {
  constructor() {
    super(Bookmark);
  }

  async findByUserEmail(
    userEmail: string,
    options?: {
      page?: number;
      limit?: number;
    },
  ): Promise<{
    bookmarks: IBookmark[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    await connectDB();

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const bookmarks = (await Bookmark.find({ userEmail })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as IBookmark[];

    const totalItems = await Bookmark.countDocuments({ userEmail });

    return {
      bookmarks,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findByUserAndQuiz(
    userEmail: string,
    quizSlug: string,
    questionIndex: number,
  ): Promise<IBookmark | null> {
    await connectDB();
    return (await Bookmark.findOne({
      userEmail,
      'quiz.slug': quizSlug,
      questionIndex,
    }).lean()) as unknown as IBookmark | null;
  }

  async deleteById(id: string): Promise<boolean> {
    return this.delete(id);
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
