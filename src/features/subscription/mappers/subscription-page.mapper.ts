import type {
  SubscriptionPlansResponseDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import type {
  CurrentSubscriptionViewModel,
  SubscriptionPageViewModel,
  SubscriptionPlanViewModel,
  SubscriptionStatusViewModel,
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
    durationDisplay: plan.durationDisplay,
    features: plan.features,
  };
}

function toCurrentSubscriptionViewModel(
  status: SubscriptionStatusResponseDto,
): CurrentSubscriptionViewModel | null {
  if (!status.subscription) return null;

  const { endDate } = status.subscription;
  return {
    ...(status.subscription.type !== undefined && { type: status.subscription.type }),
    ...(endDate !== undefined && { endDate }),
    endDateLabel: endDate ? formatDate(endDate, { locale: 'vi-VN' }) : '-',
    isActive: Boolean(status.subscription.isActive),
    ...(status.subscription.status !== undefined && { status: status.subscription.status }),
  };
}

export function toSubscriptionPageViewModel(
  plans: SubscriptionPlansResponseDto,
  status: SubscriptionStatusResponseDto,
): SubscriptionPageViewModel {
  return {
    plans: plans.plans.map(toSubscriptionPlanViewModel),
    currentSubscription: toCurrentSubscriptionViewModel(status),
    isPremium: status.isPremium,
  };
}

export function toSubscriptionStatusViewModel(
  status: SubscriptionStatusResponseDto,
): SubscriptionStatusViewModel {
  return {
    isPremium: status.isPremium,
  };
}
