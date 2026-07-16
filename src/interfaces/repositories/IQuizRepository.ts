import type { Quiz, QuizQuestionContent } from '@/entities/Quiz';
import type {
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface QuizFindOptions extends RepositoryPaginationOptions {
  sort?: Record<string, 1 | -1>;
}

type QuizTextSearchCondition = { title: RegExp } | { description: RegExp };

export interface QuizFindFilter {
  isPrivate?: boolean;
  author?: string;
  excludeAuthor?: string;
  folder?: string | null;
  $or?: QuizTextSearchCondition[];
}

export interface QuizCreatorStatRecord {
  id: string;
  email: string;
  role: 'admin' | 'user';
  joinedAt: Date;
  quizCount: number;
  totalQuestions: number;
}

export type QuizAccessRecord = Pick<Quiz, 'id' | 'author' | 'isPrivate'>;

export interface CreateQuizData {
  title: string;
  description?: string;
  slug: string;
  author: string;
  folder?: string | null;
  questions: QuizQuestionContent[];
  isPrivate: boolean;
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
}

export type UpdateQuizData = Partial<
  Pick<
    CreateQuizData,
    'title' | 'description' | 'folder' | 'questions' | 'isPrivate' | 'pdfUrl' | 'tags'
  >
>;

export interface IQuizRepository {
  findById(id: string): Promise<Quiz | null>;

  findAccessById(id: string): Promise<QuizAccessRecord | null>;

  findBySlug(slug: string): Promise<Quiz | null>;

  findSummaryBySlug(slug: string): Promise<Quiz | null>;

  findIdBySlug(slug: string): Promise<string | null>;

  findBySourceDraftId(sourceDraftId: string): Promise<Quiz | null>;

  create(quizData: CreateQuizData): Promise<Quiz>;

  update(id: string, quizData: UpdateQuizData): Promise<Quiz | null>;

  delete(id: string): Promise<boolean>;

  findAll(
    filter: QuizFindFilter,
    options: QuizFindOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>>;

  findForPlay(slug: string): Promise<Quiz | null>;

  findUserQuizzes(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>>;

  findPublicByAuthor(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>>;

  count(filter?: CreatedAtCountFilter): Promise<number>;

  countByCreatedAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;

  findTopCreators(limit: number): Promise<QuizCreatorStatRecord[]>;
}
