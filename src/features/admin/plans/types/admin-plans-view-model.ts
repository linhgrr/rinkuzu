export interface AdminBillingPlanViewModel {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  duration: string;
  durationLabel: string;
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
  isActive: boolean;
}

export interface AdminBillingPlanUpdateInput {
  planId: string;
  payload: AdminBillingPlanMutationInput;
}
