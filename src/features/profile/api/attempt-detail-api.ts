import type { AttemptDetailDto } from '@/dtos/user';
import { toAttemptDetailViewModel } from '@/features/profile/mappers/attempt-detail.mapper';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export type FetchAttemptDetailOptions = {
  userEmail?: string;
};

export async function fetchAttemptDetailViewModel(
  attemptId: string,
  locale: string,
  options?: FetchAttemptDetailOptions,
): Promise<AttemptDetailViewModel> {
  const encodedAttemptId = routePathSegment(attemptId);
  const params = new URLSearchParams();
  if (options?.userEmail) {
    params.set('userEmail', options.userEmail);
  }
  const query = params.toString();
  const dto = await fetchApiData<AttemptDetailDto>(
    `/api/attempts/${encodedAttemptId}${query ? `?${query}` : ''}`,
  );
  return toAttemptDetailViewModel(dto, locale);
}
