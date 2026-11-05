import type { DashboardBootstrapDto, DashboardStatsDto } from '@/dtos/dashboard';

export interface PostSignInTargetInput {
  userId: string;
  /** UI locale; picks the starter quiz in the learner's language. */
  locale: string;
  /** The learner pressed Skip on a starter quiz in this browser (RIN-913). */
  starterSkipped: boolean;
}

export interface IDashboardService {
  getStats(userId: string): Promise<DashboardStatsDto>;
  getBootstrapData(userId: string): Promise<DashboardBootstrapDto>;
  getPostSignInHref(input: PostSignInTargetInput): Promise<string>;
}
