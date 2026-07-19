import type { AdminSubscriptionRecord, BillingPlan } from '@/entities/AdminBilling';
import type { SubscriptionStatus } from '@/shared/constants/subscription-status';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';

export interface CreateBillingPlanData {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
}

export interface UpdateBillingPlanData {
  name?: string;
  price?: number;
  duration?: string;
  features?: string[];
  isActive?: boolean;
}

export interface AdminBillingUserIdentity {
  id: string;
  email: string;
}

export interface CreateAdminSubscriptionGrantData {
  userId: string;
  userEmail: string;
  planId: string;
  amount: number;
  startDate: Date;
  endDate?: Date;
}

export interface AdminSubscriptionListOptions {
  page: number;
  limit: number;
  status?: SubscriptionStatus;
  search?: string;
}

export interface IAdminBillingRepository {
  listPlans(): Promise<BillingPlan[]>;

  findPlanById(planId: string): Promise<BillingPlan | null>;

  createPlan(data: CreateBillingPlanData): Promise<BillingPlan>;

  updatePlan(planId: string, data: UpdateBillingPlanData): Promise<BillingPlan | null>;

  deletePlan(planId: string): Promise<boolean>;

  listSubscriptions(
    options: AdminSubscriptionListOptions,
  ): Promise<PaginatedRepositoryResult<AdminSubscriptionRecord>>;

  findUserById(userId: string): Promise<AdminBillingUserIdentity | null>;

  addUserSubscriptionGrant(input: CreateAdminSubscriptionGrantData): Promise<void>;
}
