import type {
  SubscriptionPlansResponseDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import { toSubscriptionPageViewModel } from '@/features/subscription/mappers/subscription-page.mapper';
import type { SubscriptionPageViewModel } from '@/features/subscription/types/subscription-page-view-model';
import { fetchApiData } from '@/lib/api/client';

export async function fetchSubscriptionPageViewModel(): Promise<SubscriptionPageViewModel> {
  const [plans, status] = await Promise.all([
    fetchApiData<SubscriptionPlansResponseDto>('/api/billing/plans'),
    fetchApiData<SubscriptionStatusResponseDto>('/api/entitlements/status'),
  ]);

  return toSubscriptionPageViewModel(plans, status);
}
