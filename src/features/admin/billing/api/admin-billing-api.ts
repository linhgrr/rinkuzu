import type {
  AdminBillingOrderDetailDto,
  AdminBillingOrderListDto,
  AdminBillingWebhookListDto,
} from '@/dtos/admin-billing-orders';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminBillingOrderDetailViewModel,
  toAdminBillingOrderListViewModel,
  toAdminWebhookDiagnosticListViewModel,
} from '@/features/admin/billing/mappers/admin-billing.mapper';
import type {
  AdminBillingOrderDetailViewModel,
  AdminBillingOrderListViewModel,
  AdminBillingOrderQueryInput,
  AdminWebhookDiagnosticListViewModel,
  AdminWebhookDiagnosticQueryInput,
} from '@/features/admin/billing/types/admin-billing-view-model';
import type { ExcessResolutionCommand } from '@/services/billing/domain/excess-resolution';
import type {
  MoneyAdjustmentType,
  MoneyAllocation,
} from '@/services/billing/domain/settlement-math';

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

/**
 * Every operator money mutation carries the same guard token and the same
 * headers. Restating that per call is how one of them quietly ends up without
 * the CSRF header and starts failing in production only.
 */
async function postBillingMutation<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = await getBillingCsrfToken();
  return fetchApiData<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Billing-CSRF': csrfToken },
    body: JSON.stringify(body),
  });
}

export interface RecordExternalAdjustmentInput {
  orderId: string;
  type: MoneyAdjustmentType;
  externalReference: string;
  amount: number;
  allocation: MoneyAllocation;
  occurredAt: string;
}

export async function recordExternalAdjustment(
  input: RecordExternalAdjustmentInput,
): Promise<void> {
  await postBillingMutation(
    `/api/admin/billing/orders/${encodeURIComponent(input.orderId)}/external-adjustments`,
    { ...input, currency: 'VND' },
  );
}

export interface ResolveOrderExcessInput {
  orderId: string;
  command: ExcessResolutionCommand;
  reason: string;
}

export async function resolveOrderExcess(input: ResolveOrderExcessInput): Promise<void> {
  await postBillingMutation(
    `/api/admin/billing/orders/${encodeURIComponent(input.orderId)}/excess-resolution`,
    input,
  );
}

export async function fetchAdminWebhookDiagnostics({
  page,
  limit,
  verificationClass,
  signal,
}: AdminWebhookDiagnosticQueryInput): Promise<AdminWebhookDiagnosticListViewModel> {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (verificationClass) params.set('verificationClass', verificationClass);
  const data = await fetchApiData<AdminBillingWebhookListDto>(
    `/api/admin/billing/webhooks?${params}`,
    { cache: 'no-store', signal },
  );
  return toAdminWebhookDiagnosticListViewModel(data);
}

export interface RevealedWebhookPayload {
  inboxRef: string;
  payload: string | null;
  retained: boolean;
  unreadable: boolean;
}

/**
 * A POST because revealing a retained body is an audited action rather than a
 * view. The response is deliberately not cached anywhere.
 */
export function revealWebhookPayload(inboxId: string): Promise<RevealedWebhookPayload> {
  return postBillingMutation<RevealedWebhookPayload>(
    `/api/admin/billing/webhooks/${encodeURIComponent(inboxId)}/payload`,
    {},
  );
}

export interface WebhookReplayResultView {
  inboxRef: string;
  outcome: 'requeued' | 'reclassified';
  duplicate: boolean;
}

export function replayWebhook(inboxId: string): Promise<WebhookReplayResultView> {
  return postBillingMutation<WebhookReplayResultView>(
    `/api/admin/billing/webhooks/${encodeURIComponent(inboxId)}/replay`,
    {},
  );
}
