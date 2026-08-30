import type { SubscriptionStatus } from '@/shared/constants/subscription-status';
import type { MongoIdLike } from '@/types/mongo';

export interface BillingPlanPersistenceRecord {
  _id: MongoIdLike;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A subscription document, spelled out rather than shared with the entity. */
export interface AdminSubscriptionPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
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
