interface SubscriptionPlanIdentityDto {
  id: string;
  name: string;
}

export interface SubscriptionPlanDto extends SubscriptionPlanIdentityDto {
  price: number;
  duration: string;
}

interface SubscriptionPlanViewDto extends SubscriptionPlanDto {
  durationDisplay: string;
  calculatedMonths: number;
}

export interface SubscriptionPlansResponseDto {
  plans: SubscriptionPlanViewDto[];
  meta: {
    durationFormat: 'ISO8601';
    supportedDurations: string[];
  };
}

export interface SubscriptionStatusResponseDto {
  subscription: {
    plan: SubscriptionPlanIdentityDto;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
    status?: string;
    payosOrderId?: string;
    payosTransactionId?: string;
  } | null;
  isPremium: boolean;
}
