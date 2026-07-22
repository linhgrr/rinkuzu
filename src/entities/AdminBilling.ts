import type { SubscriptionRecordFields } from '@/shared/types/subscription';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSubscriptionRecord extends SubscriptionRecordFields {
  id: string;
  user: string;
}

export interface AdminUserSubscriptionGrant {
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  startDate: Date;
  endDate?: Date;
}

export class BillingPlanConflictError extends Error {
  constructor() {
    super('A plan with this name and duration already exists');
    this.name = 'BillingPlanConflictError';
  }
}

export class BillingPlanInUseError extends Error {
  constructor() {
    super('An assigned plan cannot be deleted; deactivate it instead');
    this.name = 'BillingPlanInUseError';
  }
}

export class BillingPlanUnavailableError extends Error {
  constructor() {
    super('Plan is unavailable');
    this.name = 'BillingPlanUnavailableError';
  }
}

export class AdminBillingUserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'AdminBillingUserNotFoundError';
  }
}
