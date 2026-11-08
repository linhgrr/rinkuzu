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

/**
 * Owner fields that decide whether a public quiz may be indexed (RIN-840).
 * Server-only: it carries the owner's email, so it must never be mapped into a
 * DTO, a view model or rendered HTML.
 */
export interface QuizOwnerIndexingRecord {
  id: string;
  email?: string | null;
  isTestAccount?: boolean | null;
}

/** Quiz summary plus its owner's indexing fields, for page metadata only. */
export interface QuizMetadataRecord {
  quiz: Quiz;
  owner: QuizOwnerIndexingRecord | null;
}

export interface PublicQuizSitemapRecord {
  slug: string;
  /** Title and description tell the quiz's language (RIN-1265). */
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PublicQuizSitemapQuery {
  /** Owners whose public quizzes stay out of the sitemap. */
  excludeAuthorIds: readonly string[];
  limit: number;
}

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

  /** Summary plus the owner's server-only indexing fields (RIN-840). */
  findMetadataBySlug(slug: string): Promise<QuizMetadataRecord | null>;

  /**
   * Accounts that may own non-indexable quizzes: a superset of
   * `isNonIndexableQuizOwner` (flagged, listed, reserved or company domain).
   * The caller applies the rule itself.
   */
  findNonIndexableOwnerCandidates(): Promise<QuizOwnerIndexingRecord[]>;

  /** Newest public quizzes, slug and dates only, minus the excluded owners. */
  findPublicSitemapEntries(query: PublicQuizSitemapQuery): Promise<PublicQuizSitemapRecord[]>;

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
