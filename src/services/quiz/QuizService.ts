import {
  IQuizService,
  CreateQuizRequest,
  QuizListOptions,
} from '@/interfaces/services/IQuizService';
import { PaginationMeta } from '@/types';
import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';

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
    private quizRepository: IQuizRepository,
    private categoryRepository: ICategoryRepository,
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private discussionRepository: IDiscussionRepository,
    private reportRepository: IReportRepository,
  ) {
    this.crudService = new QuizCrudService(quizRepository, categoryRepository, userRepository);
    this.playService = new QuizPlayService(quizRepository, userRepository, attemptRepository);
    this.adminService = new QuizAdminService(quizRepository, categoryRepository);
    this.discussionService = new QuizDiscussionService(
      quizRepository,
      userRepository,
      discussionRepository,
      reportRepository,
    );
  }

  async getQuizzes(options: QuizListOptions): Promise<{
    quizzes: IQuiz[];
    pagination: PaginationMeta;
  }> {
    return this.adminService.getQuizzes(options);
  }

  async createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz> {
    return this.crudService.createQuiz(userId, quizData);
  }

  async getQuizById(
    id: string,
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<any>> {
    return this.crudService.getQuizById(id, userEmail, userRole, userId);
  }

  async getQuizBySlug(slug: string): Promise<IQuiz | null> {
    return this.crudService.getQuizBySlug(slug);
  }

  async getQuizForPlay(slug: string, userRole?: string, userId?: string): Promise<any> {
    return this.playService.getQuizForPlay(slug, userRole, userId);
  }

  async updateQuiz(
    id: string,
    quizData: any,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<any>> {
    return this.crudService.updateQuiz(id, quizData, userEmail, userRole);
  }

  async deleteQuiz(
    id: string,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<boolean>> {
    return this.crudService.deleteQuiz(id, userEmail, userRole);
  }

  async approveQuiz(id: string): Promise<ServiceResult<any>> {
    return this.adminService.approveQuiz(id);
  }

  async rejectQuiz(id: string, reason?: string): Promise<ServiceResult<any>> {
    return this.adminService.rejectQuiz(id, reason);
  }

  async previewFromPdf(
    title: string,
    description: string,
    pdfFiles: File[],
  ): Promise<ServiceResult<any>> {
    return this.adminService.previewFromPdf(title, description, pdfFiles);
  }

  async reportQuiz(
    slug: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
  ): Promise<ServiceResult<string>> {
    return this.discussionService.reportQuiz(slug, content, reporterEmail, reporterName);
  }

  async submitQuizAttempt(
    slug: string,
    answers: any[],
    session: any,
    userEmail?: string,
  ): Promise<ServiceResult<any>> {
    return this.playService.submitQuizAttempt(slug, answers, session, userEmail);
  }

  async getQuizDiscussions(slug: string, session?: any): Promise<ServiceResult<any[]>> {
    return this.discussionService.getQuizDiscussions(slug, session);
  }

  async addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    userEmail: string,
    session?: any,
  ): Promise<ServiceResult<any>> {
    return this.discussionService.addDiscussionComment(
      slug,
      questionIndex,
      content,
      userEmail,
      session,
    );
  }

  async getQuizFlashcards(slug: string, session?: any): Promise<any> {
    return this.playService.getQuizFlashcards(slug, session);
  }

  async getQuizForFlashcards(slug: string, session: any): Promise<ServiceResult<any>> {
    return this.playService.getQuizForFlashcards(slug, session);
  }
}
