import type {
  BookmarkListDto,
  BookmarkListQueryDto,
  BookmarkDto,
  BookmarkQuizListDto,
  CreateBookmarkRequestDto,
} from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';

export interface BookmarkOwner {
  userId: string;
  userEmail: string;
}

export interface IBookmarkService {
  getBookmarksByUser(userId: string, options?: BookmarkListQueryDto): Promise<BookmarkListDto>;

  getBookmarkQuizzesByUser(userId: string): Promise<BookmarkQuizListDto>;

  createBookmark(
    owner: BookmarkOwner,
    bookmarkData: CreateBookmarkRequestDto,
  ): Promise<BookmarkDto>;

  deleteBookmarkByUser(bookmarkId: string, userId: string): Promise<DeleteResultDto>;
}
