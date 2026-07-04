import type { Bookmark, BookmarkQuestion, BookmarkQuizSummary } from '@/entities/Bookmark';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface IBookmarkRepository {
  findByUserId(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Bookmark>>;

  create(bookmarkData: CreateBookmarkData): Promise<Bookmark>;

  deleteByIdAndUser(id: string, userId: string): Promise<boolean>;
}

export interface CreateBookmarkData {
  userId: string;
  userEmail: string;
  quiz: BookmarkQuizSummary;
  question: BookmarkQuestion;
  questionIndex: number;
}
