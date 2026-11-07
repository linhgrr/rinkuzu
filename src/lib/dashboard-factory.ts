import 'server-only';
import { cache } from 'react';
import type { DashboardBootstrapDto, DashboardStatsDto } from '@/dtos/dashboard';
import type { PostSignInTargetInput } from '@/interfaces/services/IDashboardService';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { DashboardService } from '@/services/dashboard/DashboardService';

const dashboardRepository = new DashboardRepository();
const dashboardService = new DashboardService(
  dashboardRepository,
  new QuizRepository(),
  dashboardRepository,
);

export const getDashboardBootstrapData = cache(
  async (userId: string): Promise<DashboardBootstrapDto> =>
    dashboardService.getBootstrapData(userId),
);

/** Locale-unprefixed href for the post-sign-in landing (RIN-913); never throws. */
export async function getPostSignInHref(input: PostSignInTargetInput): Promise<string> {
  return dashboardService.getPostSignInHref(input);
}

export async function getDashboardStats(userId: string): Promise<DashboardStatsDto> {
  return dashboardService.getStats(userId);
}
