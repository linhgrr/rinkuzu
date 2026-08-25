import type { AdminSubscriptionListDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import { toAdminSubscriptionsListViewModel } from '@/features/admin/subscriptions/mappers/admin-subscriptions.mapper';
import type {
  AdminSubscriptionsQueryInput,
  AdminSubscriptionStatusUpdateInput,
  AdminMutableSubscriptionStatusViewModel,
  AdminSubscriptionsListViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';

export async function fetchAdminSubscriptionsViewModel({
  page,
  limit,
  searchTerm,
  statusFilter,
  signal,
}: AdminSubscriptionsQueryInput): Promise<AdminSubscriptionsListViewModel> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (searchTerm) params.set('search', searchTerm);
  if (statusFilter) params.set('status', statusFilter);

  const data = await fetchApiData<AdminSubscriptionListDto>(`/api/admin/subscriptions?${params}`, {
    cache: 'no-store',
    signal,
  });

  return toAdminSubscriptionsListViewModel(data);
}

export async function updateAdminSubscriptionStatus({
  subscriptionId,
  status,
}: AdminSubscriptionStatusUpdateInput): Promise<void> {
  await fetchApiData<{ id: string; status: AdminMutableSubscriptionStatusViewModel }>(
    `/api/admin/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
}
