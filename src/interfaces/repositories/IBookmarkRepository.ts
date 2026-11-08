import type { Bookmark, BookmarkQuestion, BookmarkQuizSummary } from '@/entities/Bookmark';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export type BookmarkListOptions = RepositoryPaginationOptions & {
  quizSlug?: string;
};

/** One quiz the user has bookmarked questions from, with how many. */
interface BookmarkQuizCount {
  slug: string;
  title: string;
  count: number;
}

export interface BookmarkQuizCounts {
  /** Most bookmarks first, then slug; at most `limit` entries. */
  quizzes: BookmarkQuizCount[];
  /** Every bookmark of the user, including quizzes beyond `limit`. */
  total: number;
}

export interface IBookmarkRepository {
  findByUserId(
    userId: string,
    options: BookmarkListOptions,
  ): Promise<PaginatedRepositoryResult<Bookmark>>;

  countByQuiz(userId: string, limit: number): Promise<BookmarkQuizCounts>;

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
