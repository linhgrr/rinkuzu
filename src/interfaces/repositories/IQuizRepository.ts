import type { Quiz, QuizQuestionContent, QuizVisibility } from '@/entities/Quiz';
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
  visibility?: QuizVisibility;
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

export type QuizAccessRecord = Pick<Quiz, 'id' | 'author' | 'visibility'>;

export interface CreateQuizData {
  title: string;
  description?: string;
  slug: string;
  author: string;
  folder?: string | null;
  questions: QuizQuestionContent[];
  visibility: QuizVisibility;
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
}

export type UpdateQuizData = Partial<
  Pick<
    CreateQuizData,
    'title' | 'description' | 'folder' | 'questions' | 'visibility' | 'pdfUrl' | 'tags'
  >
>;

export interface IQuizRepository {
  findById(id: string): Promise<Quiz | null>;

  findAccessById(id: string): Promise<QuizAccessRecord | null>;

  findBySlug(slug: string): Promise<Quiz | null>;

  findSummaryBySlug(slug: string): Promise<Quiz | null>;

  findIdBySlug(slug: string): Promise<string | null>;

  /** Canonical slug of the quiz that lists `alias` in `slugAliases`, or null. */
  findCanonicalSlugByAlias(alias: string): Promise<string | null>;

  findBySourceDraftId(sourceDraftId: string): Promise<Quiz | null>;

  create(quizData: CreateQuizData): Promise<Quiz>;

  update(id: string, quizData: UpdateQuizData): Promise<Quiz | null>;

  updateQuestionById?(
    quizId: string,
    questionId: string,
    question: QuizQuestionContent,
  ): Promise<boolean>;

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

  findTopCreators(
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<QuizCreatorStatRecord>>;
}
