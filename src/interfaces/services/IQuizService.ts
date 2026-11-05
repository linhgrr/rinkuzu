import type {
  CreateQuizRequestDto,
  DeleteQuizProgressResponseDto,
  FlashcardQuizDto,
  QuizAttemptResultDto,
  QuizDiscussionDto,
  QuizDetailDto,
  QuizListDto,
  PublicQuizSitemapEntryDto,
  QuizListOptionsDto,
  QuizMetadataDto,
  QuizPlayDetailDto,
  QuizProgressResponseDto,
  ReportQuizResponseDto,
  SavedQuizProgressDto,
  SaveQuizProgressResponseDto,
  UpdateQuizRequestDto,
} from '@/dtos/quiz';
import type { DeleteResultDto } from '@/dtos/common';
import { ServiceResult } from '@/interfaces/services/types';
import type { Session } from 'next-auth';

export interface IQuizService {
  getQuizzes(options: QuizListOptionsDto): Promise<QuizListDto>;

  createQuiz(userId: string, quizData: CreateQuizRequestDto): Promise<QuizDetailDto>;

  createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<QuizDetailDto>;

  getQuizById(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>>;

  /** Public quizzes for the sitemap, minus test/company-owned ones (RIN-840). */
  getPublicSitemapQuizzes(limit: number): Promise<PublicQuizSitemapEntryDto[]>;

  /** Page metadata; `ownerIndexable` is server-only (RIN-840). */
  getQuizMetadataBySlug(slug: string): Promise<QuizMetadataDto | null>;

  /** Canonical slug when `slug` is a former slug (alias) of a quiz, else null. */
  resolveSlugAlias(slug: string): Promise<string | null>;

  getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>>;

  getRetryQuizForPlay(
    slug: string,
    retryOfAttemptId: string,
    userId?: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>>;

  getSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizProgressResponseDto>>;

  saveQuizProgress(
    slug: string,
    userId: string,
    progress: SavedQuizProgressDto,
    userRole?: string,
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>>;

  deleteSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>>;

  updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>>;

  deleteQuiz(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteResultDto>>;

  submitQuizAttempt(
    slug: string,
    answers: (number | number[])[],
    idempotencyKey: string,
    session: Session | null,
    userEmail?: string,
    retryOfAttemptId?: string,
    guestClaimToken?: string,
  ): Promise<ServiceResult<QuizAttemptResultDto>>;

  getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto[]>>;

  addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    session: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>>;

  getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>>;

  reportQuiz(
    slug: string,
    questionId: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
    session?: Session | null,
  ): Promise<ServiceResult<ReportQuizResponseDto>>;
}
