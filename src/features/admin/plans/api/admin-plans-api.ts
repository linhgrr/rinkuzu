import type { BillingPlanDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import { toAdminBillingPlanViewModels } from '@/features/admin/plans/mappers/admin-plans.mapper';
import type {
  AdminBillingPlanMutationInput,
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
): Promise<void> {
  await fetchApiData<BillingPlanDto>('/api/admin/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBillingPlan({
  planId,
  payload,
}: {
  planId: string;
  payload: AdminBillingPlanMutationInput;
}): Promise<void> {
  await fetchApiData<BillingPlanDto>('/api/admin/plans', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: planId,
      ...payload,
    }),
  });
}

export async function deleteAdminBillingPlan(planId: string): Promise<void> {
  await fetchApiData<null>('/api/admin/plans', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: planId }),
  });
}
