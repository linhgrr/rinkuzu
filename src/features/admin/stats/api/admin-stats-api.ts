import type {
  AdminStatsDto,
  AdminActivityStatsListDto,
  AdminCreatorStatsListDto,
} from '@/dtos/admin-stats';
import { fetchApiData } from '@/lib/api/client';
import { toAdminStatsViewModel } from '@/features/admin/stats/mappers/admin-stats.mapper';
import { toStatsModalResultViewModel } from '@/features/admin/stats/mappers/stats-modal.mapper';
import type { AdminStatsViewModel } from '@/features/admin/stats/types/admin-stats-view-model';
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
