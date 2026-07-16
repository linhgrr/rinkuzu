import type { PublicProfileUser, User, UserSubscriptionSnapshot } from '@/entities/User';
import { serializeId } from '@/lib/mongo-id';
import { mapEmbeddedSubscription } from '@/repositories/mappers/SubscriptionPersistenceMapper';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
  UserSubscriptionPersistenceRecord,
} from '@/repositories/types/UserPersistence';

export function toUserSubscription(
  record: UserSubscriptionPersistenceRecord,
): UserSubscriptionSnapshot {
  return mapEmbeddedSubscription(record);
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
