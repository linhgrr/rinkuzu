import type { AttemptDetailDto } from '@/dtos/user';
import { toAttemptDetailViewModel } from '@/features/profile/mappers/attempt-detail.mapper';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { GUEST_CLAIM_TOKEN_HEADER } from '@/lib/validation/guest-claim-token-header';

export type FetchAttemptDetailOptions = {
  /** Legacy guest-email attempts (before RIN-912). */
  userEmail?: string;
  /** A guest's claim token, sent as a header so it stays out of URLs and logs (RIN-912). */
  guestClaimToken?: string;
};

export async function fetchAttemptDetailViewModel(
  attemptId: string,
  locale: string,
  options?: FetchAttemptDetailOptions,
): Promise<AttemptDetailViewModel> {
  const encodedAttemptId = routePathSegment(attemptId);
  const params = new URLSearchParams();
  if (locale === 'vi' || locale === 'en') {
    params.set('locale', locale);
  }
  if (options?.userEmail) {
    params.set('userEmail', options.userEmail);
  }
  const query = params.toString();
  const url = `/api/attempts/${encodedAttemptId}${query ? `?${query}` : ''}`;
  const dto = options?.guestClaimToken
    ? await fetchApiData<AttemptDetailDto>(url, {
        headers: { [GUEST_CLAIM_TOKEN_HEADER]: options.guestClaimToken },
      })
    : await fetchApiData<AttemptDetailDto>(url);
  return toAttemptDetailViewModel(dto, locale);
}
