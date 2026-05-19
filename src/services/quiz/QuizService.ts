import {
  IQuizService,
  CreateQuizRequest,
  QuizListOptions,
  type DiscussionCommentDTO,
  type FlashcardQuizDTO,
} from '@/interfaces/services/IQuizService';
import { PaginationMeta } from '@/types';
import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { IQuestion } from '@/models/Quiz';
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
    categoryRepository: ICategoryRepository,
    userRepository: IUserRepository,
    attemptRepository: IAttemptRepository,
    discussionRepository: IDiscussionRepository,
    reportRepository: IReportRepository,
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
  ): Promise<ServiceResult<IQuiz>> {
    return this.crudService.getQuizById(id, userEmail, userRole, userId);
  }

  async getQuizBySlug(slug: string): Promise<IQuiz | null> {
    return this.crudService.getQuizBySlug(slug);
  }

  async getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<IQuiz>> {
    return this.playService.getQuizForPlay(slug, userRole, userId);
  }

  async updateQuiz(
    id: string,
    quizData: Partial<IQuiz>,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<IQuiz>> {
    return this.crudService.updateQuiz(id, quizData, userEmail, userRole);
  }

  async deleteQuiz(
    id: string,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<boolean>> {
    return this.crudService.deleteQuiz(id, userEmail, userRole);
  }

  async approveQuiz(id: string): Promise<ServiceResult<IQuiz>> {
    return this.adminService.approveQuiz(id);
  }

  async rejectQuiz(id: string, reason?: string): Promise<ServiceResult<IQuiz>> {
    return this.adminService.rejectQuiz(id, reason);
  }

  async previewFromPdf(
    title: string,
    description: string,
    pdfFiles: File[],
  ): Promise<ServiceResult<{ title: string; description: string; questions: IQuestion[] }>> {
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
    answers: (number | number[])[],
    session: Session | null,
    userEmail?: string,
  ): Promise<
    ServiceResult<{
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      attemptId: string;
    }>
  > {
    return this.playService.submitQuizAttempt(slug, answers, session, userEmail);
  }

  async getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<DiscussionCommentDTO[]>> {
    return this.discussionService.getQuizDiscussions(slug, session) as unknown as Promise<
      ServiceResult<DiscussionCommentDTO[]>
    >;
  }

  async addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    userEmail: string,
    session?: Session | null,
  ): Promise<ServiceResult<DiscussionCommentDTO>> {
    return this.discussionService.addDiscussionComment(
      slug,
      questionIndex,
      content,
      userEmail,
      session,
    ) as unknown as Promise<ServiceResult<DiscussionCommentDTO>>;
  }

  async getQuizFlashcards(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDTO>> {
    return this.playService.getQuizFlashcards(slug, session);
  }

  async getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDTO>> {
    return this.playService.getQuizForFlashcards(slug, session);
  }
}
