export type SubscriptionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSubscriptionRecord {
  id: string;
  user: string;
  userEmail: string;
  type: string;
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
