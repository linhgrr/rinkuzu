import type { BillingPlanDto } from '@/dtos/admin-billing';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminBillingPlanViewModel,
  toAdminBillingPlanViewModels,
} from '@/features/admin/plans/mappers/admin-plans.mapper';
import type {
  AdminBillingPlanMutationInput,
  AdminBillingPlanUpdateInput,
  AdminBillingPlanViewModel,
} from '@/features/admin/plans/types/admin-plans-view-model';

export async function fetchAdminBillingPlanViewModels(
  signal?: AbortSignal,
): Promise<AdminBillingPlanViewModel[]> {
  const plans = await fetchApiData<BillingPlanDto[]>('/api/admin/plans', {
    ...(signal !== undefined ? { signal } : {}),
  });
  return toAdminBillingPlanViewModels(plans);
}

async function getBillingCsrfToken(): Promise<string> {
  return (await fetchApiData<{ token: string }>('/api/billing/csrf', { method: 'POST' })).token;
}

async function planMutationHeaders(): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    'X-Billing-CSRF': await getBillingCsrfToken(),
  };
}

export async function createAdminBillingPlan(
  payload: AdminBillingPlanMutationInput,
): Promise<AdminBillingPlanViewModel> {
  const plan = await fetchApiData<BillingPlanDto>('/api/admin/plans', {
    method: 'POST',
    headers: await planMutationHeaders(),
    body: JSON.stringify(payload),
  });
  return toAdminBillingPlanViewModel(plan);
}

export async function updateAdminBillingPlan({
  planId,
  payload,
}: AdminBillingPlanUpdateInput): Promise<AdminBillingPlanViewModel> {
  const plan = await fetchApiData<BillingPlanDto>('/api/admin/plans', {
    method: 'PATCH',
    headers: await planMutationHeaders(),
    body: JSON.stringify({
      id: planId,
      ...payload,
    }),
  });
  return toAdminBillingPlanViewModel(plan);
}

export async function deleteAdminBillingPlan(planId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>('/api/admin/plans', {
    method: 'DELETE',
    headers: await planMutationHeaders(),
    body: JSON.stringify({ id: planId }),
  });
}
