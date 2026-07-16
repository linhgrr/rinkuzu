import type { Quiz } from '@/entities/Quiz';
import type { QuizFindFilter } from '@/interfaces/repositories/IQuizRepository';

export interface DashboardRecentQuizOptions {
  limit: number;
  populate?: string[];
  sort?: Record<string, 1 | -1>;
}

export interface IDashboardQuizRepository {
  findRecent(filter: QuizFindFilter, options: DashboardRecentQuizOptions): Promise<Quiz[]>;
}
