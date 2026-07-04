import type {
  BookmarkDto,
  BookmarkListDto,
  BookmarkListQueryDto,
  CreateBookmarkRequestDto,
} from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository';
import { IBookmarkService, type BookmarkOwner } from '@/interfaces/services/IBookmarkService';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { BookmarkDtoMapper } from '@/mappers/bookmark/BookmarkDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';

export class BookmarkService implements IBookmarkService {
  constructor(private bookmarkRepository: IBookmarkRepository) {}

  async getBookmarksByUser(
    userId: string,
    options: BookmarkListQueryDto,
  ): Promise<BookmarkListDto> {
    const result = await this.bookmarkRepository.findByUserId(userId, options);
    return {
      bookmarks: result.items.map(BookmarkDtoMapper.toDto),
      pagination: result.pagination,
    };
  }

  async createBookmark(
    owner: BookmarkOwner,
    bookmarkData: CreateBookmarkRequestDto,
  ): Promise<BookmarkDto> {
    const { quiz, question, questionIndex } = bookmarkData;

    try {
      const bookmark = await this.bookmarkRepository.create({
        userId: owner.userId,
        userEmail: owner.userEmail,
        quiz,
        question,
        questionIndex,
      });
      return BookmarkDtoMapper.toDto(bookmark);
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new Error('Question already bookmarked');
      }
      throw error;
    }
  }

  async deleteBookmarkByUser(bookmarkId: string, userId: string): Promise<DeleteResultDto> {
    const result = await this.bookmarkRepository.deleteByIdAndUser(bookmarkId, userId);
    if (!result) {
      throw new Error('Bookmark not found or unauthorized');
    }
    return DeleteResultDtoMapper.toDto(bookmarkId);
  }
}
