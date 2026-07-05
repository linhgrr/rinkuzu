import 'server-only';
import { cache } from 'react';
import type { DashboardBootstrapDto, DashboardStatsDto } from '@/dtos/dashboard';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { DashboardService } from '@/services/dashboard/DashboardService';

const dashboardService = new DashboardService(new DashboardRepository(), new QuizRepository());

export const getDashboardBootstrapData = cache(
  async (userId: string): Promise<DashboardBootstrapDto> =>
    dashboardService.getBootstrapData(userId),
);

export async function getDashboardStats(userId: string): Promise<DashboardStatsDto> {
  return dashboardService.getStats(userId);
}
