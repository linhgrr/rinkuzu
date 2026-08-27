import type {
  AdminBillingOrderDetailDto,
  AdminBillingOrderListDto,
} from '@/dtos/admin-billing-orders';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminBillingOrderDetailViewModel,
  toAdminBillingOrderListViewModel,
} from '@/features/admin/billing/mappers/admin-billing.mapper';
import type {
  AdminBillingOrderDetailViewModel,
  AdminBillingOrderListViewModel,
  AdminBillingOrderQueryInput,
} from '@/features/admin/billing/types/admin-billing-view-model';

export async function fetchAdminBillingOrders({
  page,
  limit,
  bucket,
  searchTerm,
  signal,
}: AdminBillingOrderQueryInput): Promise<AdminBillingOrderListViewModel> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    bucket,
  });
  if (searchTerm) params.set('search', searchTerm);

  const data = await fetchApiData<AdminBillingOrderListDto>(`/api/admin/billing/orders?${params}`, {
    cache: 'no-store',
    signal,
  });
  return toAdminBillingOrderListViewModel(data);
}

export async function fetchAdminBillingOrderDetail(
  orderId: string,
): Promise<AdminBillingOrderDetailViewModel> {
  const data = await fetchApiData<AdminBillingOrderDetailDto>(
    `/api/admin/billing/orders/${encodeURIComponent(orderId)}`,
    { cache: 'no-store' },
  );
  return toAdminBillingOrderDetailViewModel(data);
}

async function getBillingCsrfToken(): Promise<string> {
  return (await fetchApiData<{ token: string }>('/api/billing/csrf', { method: 'POST' })).token;
}

export interface RecordExternalAdjustmentInput {
  orderId: string;
  type: 'refund' | 'chargeback' | 'chargeback_reversal' | 'credit';
  externalReference: string;
  amount: number;
  allocation: 'principal' | 'excess';
  occurredAt: string;
}

export async function recordExternalAdjustment(
  input: RecordExternalAdjustmentInput,
): Promise<void> {
  const csrfToken = await getBillingCsrfToken();
  await fetchApiData(
    `/api/admin/billing/orders/${encodeURIComponent(input.orderId)}/external-adjustments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Billing-CSRF': csrfToken,
      },
      body: JSON.stringify({ ...input, currency: 'VND' }),
    },
  );
}
