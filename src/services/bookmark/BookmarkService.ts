import type {
  BookmarkDto,
  BookmarkListDto,
  BookmarkListQueryDto,
  BookmarkQuizListDto,
  CreateBookmarkRequestDto,
} from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository';
import { IBookmarkService, type BookmarkOwner } from '@/interfaces/services/IBookmarkService';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { BookmarkDtoMapper } from '@/mappers/bookmark/BookmarkDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';

/** The quiz filter lists at most this many quizzes (spec RIN-1199). */
const MAX_BOOKMARK_QUIZZES = 100;

export class BookmarkService implements IBookmarkService {
  constructor(private bookmarkRepository: IBookmarkRepository) {}

  async getBookmarksByUser(
    userId: string,
    options: BookmarkListQueryDto,
  ): Promise<BookmarkListDto> {
    const result = await this.bookmarkRepository.findByUserId(userId, {
      page: options.page,
      limit: options.limit,
      ...(options.quizSlug !== undefined && { quizSlug: options.quizSlug }),
    });
    return {
      bookmarks: result.items.map(BookmarkDtoMapper.toDto),
      pagination: result.pagination,
    };
  }

  async getBookmarkQuizzesByUser(userId: string): Promise<BookmarkQuizListDto> {
    const { quizzes, total } = await this.bookmarkRepository.countByQuiz(
      userId,
      MAX_BOOKMARK_QUIZZES,
    );
    return { quizzes: quizzes.map(({ slug, title, count }) => ({ slug, title, count })), total };
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
        quiz: {
          slug: quiz.slug,
          title: quiz.title,
          ...(quiz.description !== undefined && { description: quiz.description }),
        },
        question: {
          text: question.text,
          options: question.options,
          type: question.type,
          ...(question.correctIndex !== undefined && { correctIndex: question.correctIndex }),
          ...(question.correctIndexes !== undefined && {
            correctIndexes: question.correctIndexes,
          }),
          ...(question.questionImage !== undefined && {
            questionImage: question.questionImage,
          }),
          ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
        },
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
