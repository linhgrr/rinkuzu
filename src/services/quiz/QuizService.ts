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
import { IQuizService } from '@/interfaces/services/IQuizService';
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { Session } from 'next-auth';

import { QuizCrudService } from './QuizCrudService';
import { QuizPlayService } from './QuizPlayService';
import { QuizAdminService } from './QuizAdminService';
import { QuizDiscussionService } from './QuizDiscussionService';
import type { PremiumAccessContext, PremiumAccessDecision } from '@/entities/PremiumQuiz';

interface PremiumDiscussionAccessPolicy {
  canAccessPublishedQuiz(
    context: PremiumAccessContext,
    quizId: string,
  ): Promise<PremiumAccessDecision>;
}

export class QuizService implements IQuizService {
  private crudService: QuizCrudService;
  private playService: QuizPlayService;
  private adminService: QuizAdminService;
  private discussionService: QuizDiscussionService;

  constructor(
    quizRepository: IQuizRepository,
    userRepository: IUserRepository,
    discussionRepository: IDiscussionRepository,
    reportRepository: IReportRepository,
    quizProgressRepository: IQuizProgressRepository,
    quizAttemptProgressRepository: IQuizAttemptProgressRepository,
    folderRepository?: IFolderRepository,
    premiumAccessPolicy?: PremiumDiscussionAccessPolicy,
  ) {
    this.crudService = new QuizCrudService(quizRepository, folderRepository);
    this.playService = new QuizPlayService(
      quizRepository,
      userRepository,
      quizProgressRepository,
      quizAttemptProgressRepository,
    );
    this.adminService = new QuizAdminService(quizRepository);
    this.discussionService = new QuizDiscussionService(
      quizRepository,
      discussionRepository,
      reportRepository,
      premiumAccessPolicy,
    );
  }

  async getQuizzes(options: QuizListOptionsDto): Promise<QuizListDto> {
    return this.adminService.getQuizzes(options);
  }

  async createQuiz(userId: string, quizData: CreateQuizRequestDto): Promise<QuizDetailDto> {
    return this.crudService.createQuiz(userId, quizData);
  }

  async createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<QuizDetailDto> {
    return this.crudService.createQuizFromDraft(userId, sourceDraftId, quizData);
  }

  async getQuizById(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    return this.crudService.getQuizById(id, userId, userRole);
  }

  async getPublicSitemapQuizzes(limit: number): Promise<PublicQuizSitemapEntryDto[]> {
    return this.adminService.getPublicSitemapQuizzes(limit);
  }

  async getQuizMetadataBySlug(slug: string): Promise<QuizMetadataDto | null> {
    return this.crudService.getQuizMetadataBySlug(slug);
  }

  async resolveSlugAlias(slug: string): Promise<string | null> {
    return this.playService.resolveSlugAlias(slug);
  }

  async getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizPlayDetailDto>> {
    return this.playService.getQuizForPlay(slug, userRole, userId);
  }

  async getSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizProgressResponseDto>> {
    return this.playService.getSavedQuizProgress(slug, userId, userRole);
  }

  async saveQuizProgress(
    slug: string,
    userId: string,
    progress: SavedQuizProgressDto,
    userRole?: string,
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>> {
    return this.playService.saveQuizProgress(slug, userId, progress, userRole);
  }

  async deleteSavedQuizProgress(
    slug: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>> {
    return this.playService.deleteSavedQuizProgress(slug, userId, userRole);
  }

  async updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    return this.crudService.updateQuiz(id, quizData, userId, userRole);
  }

  async deleteQuiz(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteResultDto>> {
    return this.crudService.deleteQuiz(id, userId, userRole);
  }

  async reportQuiz(
    slug: string,
    questionId: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
    session?: Session | null,
  ): Promise<ServiceResult<ReportQuizResponseDto>> {
    return this.discussionService.reportQuiz(
      slug,
      questionId,
      content,
      reporterEmail,
      reporterName,
      session,
    );
  }

  async submitQuizAttempt(
    slug: string,
    answers: (number | number[])[],
    idempotencyKey: string,
    session: Session | null,
    userEmail?: string,
  ): Promise<ServiceResult<QuizAttemptResultDto>> {
    return this.playService.submitQuizAttempt(slug, answers, idempotencyKey, session, userEmail);
  }

  async getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto[]>> {
    return this.discussionService.getQuizDiscussions(slug, session);
  }

  async addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    session: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>> {
    return this.discussionService.addDiscussionComment(slug, questionIndex, content, session);
  }

  async getQuizFlashcards(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    return this.playService.getQuizFlashcards(slug, session);
  }

  async getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDto>> {
    return this.playService.getQuizForFlashcards(slug, session);
  }
}
