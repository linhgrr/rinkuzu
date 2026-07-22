import type { BillingPlanDto } from '@/dtos/admin-billing';
import { formatDate, formatVndCurrency } from '@/lib/formatters';
import { DurationUtils } from '@/types/subscription';
import type { AdminBillingPlanViewModel } from '@/features/admin/plans/types/admin-plans-view-model';

export function toAdminBillingPlanViewModel(plan: BillingPlanDto): AdminBillingPlanViewModel {
  const durationInfo = DurationUtils.getDurationInfo(plan.duration);

  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    priceLabel: formatVndCurrency(plan.price),
    duration: plan.duration,
    durationLabel: durationInfo.displayName,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    createdAtLabel: formatDate(plan.createdAt),
    updatedAt: plan.updatedAt,
    updatedAtLabel: formatDate(plan.updatedAt),
  };
}

export function toAdminBillingPlanViewModels(plans: BillingPlanDto[]): AdminBillingPlanViewModel[] {
  return plans.map(toAdminBillingPlanViewModel);
}
