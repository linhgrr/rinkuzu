import type { SubscriptionStatus } from '@/shared/constants/subscription-status';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A subscription as the domain works with it.
 *
 * These fields were shared with the persistence record through
 * src/shared/types/subscription.ts, which the standard rules out: src/shared is
 * for layer-agnostic primitives, never whole record shapes. Sharing one meant a
 * column added for storage arrived in the domain without anyone deciding it
 * should.
 */
export interface AdminSubscriptionRecord {
  id: string;
  user: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
