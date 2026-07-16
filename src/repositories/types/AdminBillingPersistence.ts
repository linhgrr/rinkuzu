import type { SubscriptionRecordFields } from '@/entities/Subscription';
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

export interface AdminSubscriptionPersistenceRecord extends SubscriptionRecordFields {
  _id: MongoIdLike;
  user: MongoIdLike;
}
