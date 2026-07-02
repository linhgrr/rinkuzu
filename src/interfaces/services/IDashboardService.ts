import type { DashboardBootstrapDto, DashboardStatsDto } from '@/dtos/dashboard';

export interface IDashboardService {
  getStats(userId: string): Promise<DashboardStatsDto>;
  getBootstrapData(userId: string): Promise<DashboardBootstrapDto>;
}
