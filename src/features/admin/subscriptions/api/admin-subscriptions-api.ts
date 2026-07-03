import type { AdminSubscriptionDto, AdminSubscriptionListDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminSubscriptionsListViewModel,
  toAdminSubscriptionViewModel,
} from '@/features/admin/subscriptions/mappers/admin-subscriptions.mapper';
import type {
  AdminMutableSubscriptionStatusViewModel,
  AdminSubscriptionViewModel,
  AdminSubscriptionStatusViewModel,
  AdminSubscriptionsListViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';

export async function fetchAdminSubscriptionsViewModel({
  page,
  limit,
  searchTerm,
  statusFilter,
  signal,
}: {
  page: number;
  limit: number;
  searchTerm: string;
  statusFilter: '' | AdminSubscriptionStatusViewModel;
  signal: AbortSignal;
}): Promise<AdminSubscriptionsListViewModel> {
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
}: {
  subscriptionId: string;
  status: AdminMutableSubscriptionStatusViewModel;
}): Promise<AdminSubscriptionViewModel> {
  const data = await fetchApiData<AdminSubscriptionDto>(
    `/api/admin/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
  return toAdminSubscriptionViewModel(data);
}
