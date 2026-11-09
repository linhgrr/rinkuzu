import type {
  SubscriptionPlansResponseDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import type {
  CurrentSubscriptionViewModel,
  SubscriptionPageViewModel,
  SubscriptionPlanViewModel,
} from '@/features/subscription/types/subscription-page-view-model';
import { formatDate, formatVndCurrency } from '@/lib/formatters';

function toSubscriptionPlanViewModel(
  plan: SubscriptionPlansResponseDto['plans'][number],
): SubscriptionPlanViewModel {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    priceLabel: formatVndCurrency(plan.price),
    calculatedMonths: plan.calculatedMonths,
  };
}

function toCurrentSubscriptionViewModel(
  status: SubscriptionStatusResponseDto,
  locale: string,
): CurrentSubscriptionViewModel | null {
  if (!status.subscription) return null;

  const { endDate } = status.subscription;
  return {
    plan: status.subscription.plan,
    ...(endDate !== undefined && { endDate }),
    endDateLabel: endDate ? formatDate(endDate, { locale }) : '-',
    isActive: status.subscription.isActive,
    ...(status.subscription.status !== undefined && { status: status.subscription.status }),
  };
}

export function toSubscriptionPageViewModel(
  plans: SubscriptionPlansResponseDto,
  status: SubscriptionStatusResponseDto,
  /** Active app locale; the end date follows it (RIN-1265). */
  locale: string,
): SubscriptionPageViewModel {
  return {
    plans: plans.plans.map(toSubscriptionPlanViewModel),
    currentSubscription: toCurrentSubscriptionViewModel(status, locale),
    isPremium: status.isPremium,
  };
}
