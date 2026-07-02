import type {
  CreateQuizRequestDto,
  DeleteQuizProgressResponseDto,
  FlashcardQuizDto,
  QuizAttemptResultDto,
  QuizDiscussionDto,
  QuizDetailDto,
  QuizListDto,
  QuizListOptionsDto,
  QuizPlayDetailDto,
  QuizProgressResponseDto,
  ReportQuizResponseDto,
  SavedQuizProgressDto,
  SaveQuizProgressResponseDto,
  UpdateQuizRequestDto,
} from '@/dtos/quiz';
import { IQuizService } from '@/interfaces/services/IQuizService';
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { Quiz } from '@/entities/Quiz';
import type { Session } from 'next-auth';

import { QuizCrudService } from './QuizCrudService';
import { QuizPlayService } from './QuizPlayService';
import { QuizAdminService } from './QuizAdminService';
import { QuizDiscussionService } from './QuizDiscussionService';

export class QuizService implements IQuizService {
  private crudService: QuizCrudService;
  private playService: QuizPlayService;
  private adminService: QuizAdminService;
  private discussionService: QuizDiscussionService;

  constructor(
    quizRepository: IQuizRepository,
    userRepository: IUserRepository,
    attemptRepository: IAttemptRepository,
    discussionRepository: IDiscussionRepository,
    reportRepository: IReportRepository,
    quizProgressRepository: IQuizProgressRepository,
    folderRepository?: IFolderRepository,
    quizAttemptProgressRepository?: IQuizAttemptProgressRepository,
  ) {
    this.crudService = new QuizCrudService(quizRepository, userRepository, folderRepository);
    this.playService = new QuizPlayService(
      quizRepository,
      userRepository,
      attemptRepository,
      quizProgressRepository,
      quizAttemptProgressRepository,
    );
    this.adminService = new QuizAdminService(quizRepository);
    this.discussionService = new QuizDiscussionService(
      quizRepository,
      userRepository,
      discussionRepository,
      reportRepository,
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
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    return this.crudService.getQuizById(id, userEmail, userRole, userId);
  }

  async getQuizBySlug(slug: string): Promise<Quiz | null> {
    return this.crudService.getQuizBySlug(slug);
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
  ): Promise<ServiceResult<QuizProgressResponseDto>> {
    return this.playService.getSavedQuizProgress(slug, userId);
  }

  async saveQuizProgress(
    slug: string,
    userId: string,
    progress: SavedQuizProgressDto,
  ): Promise<ServiceResult<SaveQuizProgressResponseDto>> {
    return this.playService.saveQuizProgress(slug, userId, progress);
  }

  async deleteSavedQuizProgress(
    slug: string,
    userId: string,
  ): Promise<ServiceResult<DeleteQuizProgressResponseDto>> {
    return this.playService.deleteSavedQuizProgress(slug, userId);
  }

  async updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    return this.crudService.updateQuiz(id, quizData, userId, userRole);
  }

  async deleteQuiz(id: string, userId: string, userRole?: string): Promise<ServiceResult<boolean>> {
    return this.crudService.deleteQuiz(id, userId, userRole);
  }

  async reportQuiz(
    slug: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
  ): Promise<ServiceResult<ReportQuizResponseDto>> {
    return this.discussionService.reportQuiz(slug, content, reporterEmail, reporterName);
  }

  async submitQuizAttempt(
    slug: string,
    answers: (number | number[])[],
    session: Session | null,
    userEmail?: string,
  ): Promise<ServiceResult<QuizAttemptResultDto>> {
    return this.playService.submitQuizAttempt(slug, answers, session, userEmail);
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
    userEmail: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>> {
    return this.discussionService.addDiscussionComment(
      slug,
      questionIndex,
      content,
      userEmail,
      session,
    );
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
