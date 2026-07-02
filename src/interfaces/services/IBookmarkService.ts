import type {
  BookmarkListDto,
  BookmarkListQueryDto,
  BookmarkDto,
  CreateBookmarkRequestDto,
} from '@/dtos/bookmark';

export interface IBookmarkService {
  getBookmarksByUser(userEmail: string, options?: BookmarkListQueryDto): Promise<BookmarkListDto>;

  createBookmark(userEmail: string, bookmarkData: CreateBookmarkRequestDto): Promise<BookmarkDto>;

  deleteBookmarkByUser(bookmarkId: string, userEmail: string): Promise<boolean>;
}
