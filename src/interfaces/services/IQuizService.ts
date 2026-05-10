import { IQuiz } from '@/interfaces/repositories/IQuizRepository';
import type { IQuestion } from '@/models/Quiz';
import { PaginationMeta } from '@/types';
import { ServiceResult } from '@/interfaces/services/types';

export interface CreateQuizRequest {
  title: string;
  description?: string;
  category: string;
  questions: IQuestion[];
  isPrivate: boolean;
  pdfUrl?: string;
}

export interface QuizListOptions {
  status?: string;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  isPrivate?: boolean;
  userRole?: string;
  userId?: string;
  onlyMine?: boolean;
  compact?: boolean;
}

export interface IQuizService {
  getQuizzes(options: QuizListOptions): Promise<{
    quizzes: IQuiz[];
    pagination: PaginationMeta;
  }>;

  createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz>;

  getQuizById(
    id: string,
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<IQuiz>>;

  getQuizBySlug(slug: string): Promise<IQuiz | null>;

  getQuizForPlay(slug: string, userRole?: string, userId?: string): Promise<ServiceResult<IQuiz>>;

  updateQuiz(
    id: string,
    quizData: Partial<IQuiz>,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<IQuiz>>;

  deleteQuiz(id: string, userEmail: string, userRole?: string): Promise<ServiceResult<boolean>>;

  approveQuiz(id: string): Promise<ServiceResult<IQuiz>>;

  rejectQuiz(id: string, reason?: string): Promise<ServiceResult<IQuiz>>;

  submitQuizAttempt(
    slug: string,
    answers: (number | number[])[],
    session: Record<string, unknown> | null,
    userEmail?: string,
  ): Promise<
    ServiceResult<{
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      attemptId: string;
    }>
  >;

  getQuizDiscussions(
    slug: string,
    session?: Record<string, unknown> | null,
  ): Promise<ServiceResult<any[]>>;

  addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    userEmail: string,
    session?: Record<string, unknown> | null,
  ): Promise<ServiceResult<any>>;

  getQuizForFlashcards(
    slug: string,
    session: Record<string, unknown> | null,
  ): Promise<ServiceResult<any>>;

  reportQuiz(
    slug: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
  ): Promise<ServiceResult<string>>;

  previewFromPdf(
    title: string,
    description: string,
    pdfFiles: File[],
  ): Promise<ServiceResult<{ title: string; description: string; questions: IQuestion[] }>>;
}
