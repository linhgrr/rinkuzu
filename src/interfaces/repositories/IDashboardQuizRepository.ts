import type { Quiz } from '@/entities/Quiz';
import type { QuizFindFilter, QuizFindOptions } from '@/interfaces/repositories/IQuizRepository';

export type DashboardRecentQuizOptions = Pick<QuizFindOptions, 'limit' | 'populate' | 'sort'>;

export interface IDashboardQuizRepository {
  findRecent(filter: QuizFindFilter, options: DashboardRecentQuizOptions): Promise<Quiz[]>;
}
