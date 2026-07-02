import type { PublicProfileUser, User, UserSubscriptionSnapshot } from '@/entities/User';
import { serializeId } from '@/lib/mongo-id';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
  UserSubscriptionPersistenceRecord,
} from '@/repositories/types/UserPersistence';

function toSubscription(record: UserSubscriptionPersistenceRecord): UserSubscriptionSnapshot {
  return {
    type: record.type,
    startDate: record.startDate,
    endDate: record.endDate,
    isActive: record.isActive,
    payosOrderId: record.payosOrderId,
    payosTransactionId: record.payosTransactionId,
  };
}

export class UserPersistenceMapper {
  static toEntity(record: UserPersistenceRecord): User {
    return {
      id: serializeId(record._id, 'user._id'),
      email: record.email,
      name: record.name,
      displayName: record.displayName,
      bio: record.bio,
      avatar: record.avatar,
      role: record.role,
      subscription: record.subscription ? toSubscription(record.subscription) : undefined,
      createdAt: record.createdAt,
    };
  }

  static toPublicProfile(record: PublicProfileUserPersistenceRecord): PublicProfileUser {
    return {
      id: serializeId(record._id, 'user._id'),
      email: record.email,
      name: record.name,
      displayName: record.displayName,
      bio: record.bio,
      avatar: record.avatar,
      createdAt: record.createdAt,
    };
  }
}
