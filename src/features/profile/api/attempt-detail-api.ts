import type { AttemptDetailDto } from '@/dtos/user';
import { toAttemptDetailViewModel } from '@/features/profile/mappers/attempt-detail.mapper';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function fetchAttemptDetailViewModel(
  attemptId: string,
  locale: string,
): Promise<AttemptDetailViewModel> {
  const encodedAttemptId = routePathSegment(attemptId);
  const dto = await fetchApiData<AttemptDetailDto>(`/api/attempts/${encodedAttemptId}`);
  return toAttemptDetailViewModel(dto, locale);
}
