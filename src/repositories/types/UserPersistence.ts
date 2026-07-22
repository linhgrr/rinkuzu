import type { AccountDisableState } from '@/shared/constants/account-disable';
import type { MongoIdLike } from '@/types/mongo';

export interface UserSubscriptionPersistenceRecord {
  planId: string;
  planName: string;
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
  disable: AccountDisableState;
  disabledAt?: Date | null;
  disabledBy?: MongoIdLike | null;
  subscription?: UserSubscriptionPersistenceRecord;
  createdAt: Date;
}

export interface PublicProfileUserPersistenceRecord {
  _id: MongoIdLike;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  createdAt: Date;
}

export interface UserSubscriptionProjection {
  subscription?: UserSubscriptionPersistenceRecord;
  disable?: AccountDisableState;
}
