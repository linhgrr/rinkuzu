import type {
  AdminActivationStatsDto,
  AdminStatsDto,
  AdminActivityStatsListDto,
  AdminCreatorStatsListDto,
  AdminGrowthTrendsDto,
} from '@/dtos/admin-stats';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminGrowthTrendsViewModel,
  toAdminStatsViewModel,
} from '@/features/admin/stats/mappers/admin-stats.mapper';
import { toStatsModalResultViewModel } from '@/features/admin/stats/mappers/stats-modal.mapper';
import type {
  ActivationFunnelViewModel,
  AdminGrowthPeriodViewModel,
  AdminGrowthTrendsViewModel,
  AdminStatsViewModel,
} from '@/features/admin/stats/types/admin-stats-view-model';
import type {
  FetchStatsModalInput,
  StatsModalResultViewModel,
} from '@/features/admin/stats/types/stats-modal-view-model';

export async function fetchAdminStatsViewModel(): Promise<AdminStatsViewModel> {
  const data = await fetchApiData<AdminStatsDto>('/api/admin/stats');
  return toAdminStatsViewModel(data);
}

type StatsModalPayloadDto = AdminCreatorStatsListDto | AdminActivityStatsListDto;

export async function fetchStatsModalViewModel(
  input: FetchStatsModalInput,
): Promise<StatsModalResultViewModel> {
  const params = new URLSearchParams({
    page: input.page.toString(),
    limit: input.limit.toString(),
    ...(input.search ? { search: input.search } : {}),
    ...(input.sortBy ? { sortBy: input.sortBy } : {}),
    sortOrder: input.sortOrder,
  });
  const separator = input.apiEndpoint.includes('?') ? '&' : '?';
  const payload = await fetchApiData<StatsModalPayloadDto>(
    `${input.apiEndpoint}${separator}${params}`,
  );
  return toStatsModalResultViewModel(input.type, payload);
}

export async function fetchGrowthTrendsViewModel(
  days: AdminGrowthPeriodViewModel,
): Promise<AdminGrowthTrendsViewModel> {
  const dto = await fetchApiData<AdminGrowthTrendsDto>(`/api/admin/stats/growth?days=${days}`);
  return toAdminGrowthTrendsViewModel(dto);
}

export async function fetchActivationFunnelViewModel(
  signal?: AbortSignal,
): Promise<ActivationFunnelViewModel> {
  const dto = await fetchApiData<AdminActivationStatsDto>('/api/admin/stats/activation?weeks=8', {
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  const now = Date.parse(dto.generatedAt);
  return {
    adaptiveAvailable: dto.sources.adaptive === 'ok',
    weeks: dto.weeks
      .map((week) => ({
        isoWeek: week.isoWeek,
        monday: week.start.slice(0, 10),
        signups: week.signups,
        signedIn: week.signedIn,
        startedQuiz: week.startedQuiz,
        activated: week.activated,
        returnedWeek1: week.returnedWeek1,
        inProgress: Date.parse(week.start) <= now && now <= Date.parse(week.end),
      }))
      .reverse(),
  };
}
