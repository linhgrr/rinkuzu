import type { Bookmark, BookmarkQuestion, BookmarkQuizSummary } from '@/entities/Bookmark';
import type {
  PaginatedRepositoryResult,
  RequiredRepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface IBookmarkRepository {
  findByUserEmail(
    userEmail: string,
    options: RequiredRepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Bookmark>>;

  findByUserAndQuiz(
    userEmail: string,
    quizSlug: string,
    questionIndex: number,
  ): Promise<Bookmark | null>;

  create(bookmarkData: CreateBookmarkData): Promise<Bookmark>;

  deleteByIdAndUser(id: string, userEmail: string): Promise<boolean>;
}

export interface CreateBookmarkData {
  userId: string;
  userEmail: string;
  quiz: BookmarkQuizSummary;
  question: BookmarkQuestion;
  questionIndex: number;
}
