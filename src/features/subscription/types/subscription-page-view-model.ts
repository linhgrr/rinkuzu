export interface SubscriptionPlanViewModel {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  durationDisplay: string;
  features: string[];
}

export interface CurrentSubscriptionViewModel {
  type?: string;
  endDate?: string;
  isLifetime: boolean;
  endDateLabel: string;
  isActive: boolean;
  status?: string;
}

export interface SubscriptionPageViewModel {
  plans: SubscriptionPlanViewModel[];
  currentSubscription: CurrentSubscriptionViewModel | null;
  isPremium: boolean;
}

export interface SubscriptionStatusViewModel {
  isPremium: boolean;
}
