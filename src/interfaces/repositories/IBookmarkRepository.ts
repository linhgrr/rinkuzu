import type { Bookmark, BookmarkQuestion, BookmarkQuizSummary } from '@/entities/Bookmark';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export type BookmarkListOptions = RepositoryPaginationOptions & {
  quizSlug?: string;
};

export interface IBookmarkRepository {
  findByUserId(
    userId: string,
    options: BookmarkListOptions,
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
