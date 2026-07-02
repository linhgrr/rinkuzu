export interface AdminBillingPlanViewModel {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  duration: string;
  durationLabel: string;
  features: string[];
  isActive: boolean;
  createdAt: string;
  createdAtLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
}

export interface AdminBillingPlanMutationInput {
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
}
