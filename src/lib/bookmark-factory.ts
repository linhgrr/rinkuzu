import { BookmarkRepository } from '@/repositories/BookmarkRepository';
import { BookmarkService } from '@/services/bookmark/BookmarkService';

let bookmarkService: BookmarkService | undefined;

export function getBookmarkService(): BookmarkService {
  bookmarkService ??= new BookmarkService(new BookmarkRepository());
  return bookmarkService;
}
