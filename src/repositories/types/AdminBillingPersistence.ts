import type { SubscriptionRecordFields } from '@/shared/types/subscription';
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

export interface AdminSubscriptionPersistenceRecord extends SubscriptionRecordFields {
  _id: MongoIdLike;
  user: MongoIdLike;
}
