import type { MongoIdLike } from '@/types/mongo';

export interface AccountSubscriptionPersistenceRecord {
  type: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface AccountProfilePersistenceRecord {
  _id: MongoIdLike;
  email: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  subscription?: AccountSubscriptionPersistenceRecord;
}

export interface AccountCredentialsPersistenceRecord {
  _id: MongoIdLike;
  password?: string;
}
