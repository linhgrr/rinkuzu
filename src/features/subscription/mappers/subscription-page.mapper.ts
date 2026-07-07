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
import { isLifetimeEndDate } from '@/lib/subscription-date';

export function toSubscriptionPlanViewModel(
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

export function toCurrentSubscriptionViewModel(
  status: SubscriptionStatusResponseDto,
): CurrentSubscriptionViewModel | null {
  if (!status.subscription) return null;

  const { endDate } = status.subscription;
  const isLifetime = isLifetimeEndDate(endDate);

  return {
    type: status.subscription.type,
    endDate,
    isLifetime,
    // For lifetime, the label is rendered from i18n at the component (no raw
    // sentinel date). Otherwise a formatted date, or '-' when absent.
    endDateLabel: isLifetime ? '' : endDate ? formatDate(endDate, { locale: 'vi-VN' }) : '-',
    isActive: Boolean(status.subscription.isActive),
    status: status.subscription.status,
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
