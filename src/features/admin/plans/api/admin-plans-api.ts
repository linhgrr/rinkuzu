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
  const plans = await fetchApiData<BillingPlanDto[]>('/api/admin/plans', { signal });
  return toAdminBillingPlanViewModels(plans);
}

export async function createAdminBillingPlan(
  payload: AdminBillingPlanMutationInput,
): Promise<AdminBillingPlanViewModel> {
  const plan = await fetchApiData<BillingPlanDto>('/api/admin/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: planId }),
  });
}
