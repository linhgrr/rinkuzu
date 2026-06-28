import type { IUserPreview, PaginationMeta } from '@/types/index';
import type { IQuestion } from '@/models/Quiz';

export interface IQuiz {
  _id?: string;
  title: string;
  description?: string;
  slug: string;
  author: string | IUserPreview;
  folder?: string | null;
  questions: IQuestion[];
  isPrivate: boolean;
  pdfUrl?: string;
  tags?: string[];
  questionCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IQuizRepository {
  findById(id: string): Promise<IQuiz | null>;

  findBySlug(slug: string): Promise<IQuiz | null>;

  create(quizData: Partial<IQuiz>): Promise<IQuiz>;

  update(id: string, quizData: Partial<IQuiz>): Promise<IQuiz | null>;

  delete(id: string): Promise<boolean>;

  findAll(
    filter?: Record<string, unknown>,
    options?: {
      page?: number;
      limit?: number;
      sort?: Record<string, unknown>;
      populate?: string[];
      compact?: boolean;
    },
  ): Promise<{
    quizzes: IQuiz[];
    pagination: PaginationMeta;
  }>;

  findForPlay(slug: string): Promise<IQuiz | null>;

  findUserQuizzes(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
    },
  ): Promise<{
    quizzes: IQuiz[];
    pagination: PaginationMeta;
  }>;

  count(filter?: Record<string, unknown>): Promise<number>;

  findRecentQuizzes(limit?: number): Promise<IQuiz[]>;
}
