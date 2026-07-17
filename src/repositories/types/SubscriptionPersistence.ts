import type { SubscriptionRecordFields } from '@/entities/Subscription';
import type { MongoIdLike } from '@/types/mongo';

interface CurrentSubscriptionSnapshotPersistenceRecord {
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

export interface SubscriptionPersistenceRecord extends SubscriptionRecordFields {
  _id: MongoIdLike;
  user: MongoIdLike;
}
