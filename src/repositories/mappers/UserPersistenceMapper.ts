import type { PublicProfileUser, User, UserSubscriptionSnapshot } from '@/entities/User';
import { serializeId } from '@/lib/mongo-id';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
  UserSubscriptionPersistenceRecord,
} from '@/repositories/types/UserPersistence';

export function toUserSubscription(
  record: UserSubscriptionPersistenceRecord,
): UserSubscriptionSnapshot {
  return {
    type: record.type,
    isActive: record.isActive,
    ...(record.startDate === undefined ? {} : { startDate: record.startDate }),
    ...(record.endDate === undefined ? {} : { endDate: record.endDate }),
    ...(record.payosOrderId === undefined ? {} : { payosOrderId: record.payosOrderId }),
    ...(record.payosTransactionId === undefined
      ? {}
      : { payosTransactionId: record.payosTransactionId }),
  };
}

export class UserPersistenceMapper {
  static toEntity(record: UserPersistenceRecord): User {
    return {
      id: serializeId(record._id, 'user._id'),
      email: record.email,
      role: record.role,
      createdAt: record.createdAt,
      ...(record.name === undefined ? {} : { name: record.name }),
      ...(record.displayName === undefined ? {} : { displayName: record.displayName }),
      ...(record.bio === undefined ? {} : { bio: record.bio }),
      ...(record.avatar === undefined ? {} : { avatar: record.avatar }),
      ...(record.subscription === undefined
        ? {}
        : { subscription: toUserSubscription(record.subscription) }),
    };
  }

  static toPublicProfile(record: PublicProfileUserPersistenceRecord): PublicProfileUser {
    return {
      id: serializeId(record._id, 'user._id'),
      email: record.email,
      createdAt: record.createdAt,
      ...(record.name === undefined ? {} : { name: record.name }),
      ...(record.displayName === undefined ? {} : { displayName: record.displayName }),
      ...(record.bio === undefined ? {} : { bio: record.bio }),
      ...(record.avatar === undefined ? {} : { avatar: record.avatar }),
    };
  }
}
