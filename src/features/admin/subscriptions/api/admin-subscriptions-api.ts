import type { AdminSubscriptionListDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import { toAdminSubscriptionsListViewModel } from '@/features/admin/subscriptions/mappers/admin-subscriptions.mapper';
import type {
  AdminSubscriptionsQueryInput,
  AdminSubscriptionRevokeInput,
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

async function getBillingCsrfToken(): Promise<string> {
  return (await fetchApiData<{ token: string }>('/api/billing/csrf', { method: 'POST' })).token;
}

export async function revokeAdminSubscription({
  subscriptionId,
  reason,
}: AdminSubscriptionRevokeInput): Promise<void> {
  const csrfToken = await getBillingCsrfToken();
  await fetchApiData<{ id: string; status: 'expired'; isActive: false }>(
    `/api/admin/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Billing-CSRF': csrfToken,
      },
      body: JSON.stringify({ action: 'revoke', reason }),
    },
  );
}
