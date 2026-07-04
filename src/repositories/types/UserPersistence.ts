import type { MongoIdLike } from '@/types/mongo';

export interface UserSubscriptionPersistenceRecord {
  type: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface UserPersistenceRecord {
  _id: MongoIdLike;
  email: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  subscription?: UserSubscriptionPersistenceRecord;
  createdAt: Date;
}

export interface PublicProfileUserPersistenceRecord {
  _id: MongoIdLike;
  email: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  createdAt: Date;
}

export interface UserSubscriptionProjection {
  subscription?: UserSubscriptionPersistenceRecord;
}
