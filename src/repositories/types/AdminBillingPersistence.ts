import type { AdminSubscriptionRecord } from '@/entities/AdminBilling';
import type { MongoIdLike } from '@/types/mongo';

export interface BillingPlanPersistenceRecord {
  _id: MongoIdLike;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSubscriptionPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
  userEmail: string;
  type: string;
  amount: number;
  currency: string;
  status: AdminSubscriptionRecord['status'];
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
