import type { BillingPlan } from '@/entities/AdminBilling';

export interface ISubscriptionPlanRepository {
  findById(planId: string): Promise<BillingPlan | null>;
  findActiveById(planId: string): Promise<BillingPlan | null>;
  listActive(): Promise<BillingPlan[]>;
}
