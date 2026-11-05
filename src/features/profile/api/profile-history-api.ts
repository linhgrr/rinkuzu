import type { UserAttemptListDto } from '@/dtos/user';
import { fetchApiData } from '@/lib/api/client';
import { toProfileHistoryViewModel } from '@/features/profile/mappers/profile-history.mapper';
import type { ProfileHistoryViewModel } from '@/features/profile/types/profile-history-view-model';

export async function fetchProfileHistoryViewModel(
  params: URLSearchParams,
  locale: string,
): Promise<ProfileHistoryViewModel> {
  const data = await fetchApiData<UserAttemptListDto>(`/api/user/attempts?${params}`);
  return toProfileHistoryViewModel(data, locale);
}
