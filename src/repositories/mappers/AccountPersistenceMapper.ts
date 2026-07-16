import type { AccountCredentials, AccountProfile, AccountSubscription } from '@/entities/Account';
import { serializeId } from '@/lib/mongo-id';
import { mapEmbeddedSubscription } from '@/repositories/mappers/SubscriptionPersistenceMapper';
import type {
  AccountCredentialsPersistenceRecord,
  AccountProfilePersistenceRecord,
  AccountSubscriptionPersistenceRecord,
} from '@/repositories/types/AccountPersistence';

function toSubscription(subscription: AccountSubscriptionPersistenceRecord): AccountSubscription {
  return mapEmbeddedSubscription(subscription);
}

export class AccountPersistenceMapper {
  static toProfile(record: AccountProfilePersistenceRecord): AccountProfile {
    return {
      id: serializeId(record._id, 'account._id'),
      email: record.email,
      role: record.role,
      createdAt: record.createdAt,
      ...(record.displayName === undefined ? {} : { displayName: record.displayName }),
      ...(record.bio === undefined ? {} : { bio: record.bio }),
      ...(record.avatar === undefined ? {} : { avatar: record.avatar }),
      ...(record.subscription === undefined
        ? {}
        : { subscription: toSubscription(record.subscription) }),
    };
  }

  static toCredentials(record: AccountCredentialsPersistenceRecord): AccountCredentials {
    return {
      id: serializeId(record._id, 'account._id'),
      ...(record.password === undefined ? {} : { passwordHash: record.password }),
    };
  }
}
