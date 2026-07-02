import type { SubscriptionStatus } from '@/entities/Subscription';
import type { MongoIdLike } from '@/types/mongo';

export interface SubscriptionUserPersistenceRecord {
  _id: MongoIdLike;
  email?: string;
  role?: 'admin' | 'user';
}

export interface CurrentSubscriptionSnapshotPersistenceRecord {
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
}

export interface CurrentUserSubscriptionPersistenceRecord {
  _id: MongoIdLike;
  subscription?: CurrentSubscriptionSnapshotPersistenceRecord;
}

export interface ExpiredSubscriptionCandidatePersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
  payosOrderId: string;
}

export interface SubscriptionPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike | SubscriptionUserPersistenceRecord;
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
