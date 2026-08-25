export interface SubscriptionPlanViewModel {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  durationDisplay: string;
  calculatedMonths: number;
}

export interface CurrentSubscriptionViewModel {
  plan: {
    id: string;
    name: string;
  };
  endDate?: string;
  endDateLabel: string;
  isActive: boolean;
  status?: string;
}

export interface SubscriptionPageViewModel {
  plans: SubscriptionPlanViewModel[];
  currentSubscription: CurrentSubscriptionViewModel | null;
  isPremium: boolean;
}
