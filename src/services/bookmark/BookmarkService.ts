import type {
  BookmarkDto,
  BookmarkListDto,
  BookmarkListQueryDto,
  CreateBookmarkRequestDto,
} from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository';
import { IBookmarkService } from '@/interfaces/services/IBookmarkService';
import { BookmarkDtoMapper } from '@/mappers/bookmark/BookmarkDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';

export class BookmarkService implements IBookmarkService {
  constructor(private bookmarkRepository: IBookmarkRepository) {}

  async getBookmarksByUser(
    userEmail: string,
    options: BookmarkListQueryDto,
  ): Promise<BookmarkListDto> {
    const result = await this.bookmarkRepository.findByUserEmail(userEmail, options);
    return {
      bookmarks: result.items.map(BookmarkDtoMapper.toDto),
      pagination: result.pagination,
    };
  }

  async createBookmark(
    userEmail: string,
    bookmarkData: CreateBookmarkRequestDto,
  ): Promise<BookmarkDto> {
    const { quiz, question, questionIndex } = bookmarkData;

    // Check if bookmark already exists
    const existingBookmark = await this.bookmarkRepository.findByUserAndQuiz(
      userEmail,
      quiz.slug,
      questionIndex,
    );

    if (existingBookmark) {
      throw new Error('Question already bookmarked');
    }

    const bookmark = await this.bookmarkRepository.create({
      userId: userEmail,
      userEmail,
      quiz,
      question,
      questionIndex,
    });
    return BookmarkDtoMapper.toDto(bookmark);
  }

  async deleteBookmarkByUser(bookmarkId: string, userEmail: string): Promise<DeleteResultDto> {
    const result = await this.bookmarkRepository.deleteByIdAndUser(bookmarkId, userEmail);
    if (!result) {
      throw new Error('Bookmark not found or unauthorized');
    }
    return DeleteResultDtoMapper.toDto(bookmarkId);
  }
}
