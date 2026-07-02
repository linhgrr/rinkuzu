import type { AccountCredentials, AccountProfile, AccountSubscription } from '@/entities/Account';
import { serializeId } from '@/lib/mongo-id';
import type {
  AccountCredentialsPersistenceRecord,
  AccountProfilePersistenceRecord,
  AccountSubscriptionPersistenceRecord,
} from '@/repositories/types/AccountPersistence';

function toSubscription(
  subscription: AccountSubscriptionPersistenceRecord | undefined,
): AccountSubscription | undefined {
  if (!subscription) return undefined;
  return {
    type: subscription.type,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    isActive: subscription.isActive,
    payosOrderId: subscription.payosOrderId,
    payosTransactionId: subscription.payosTransactionId,
  };
}

export class AccountPersistenceMapper {
  static toProfile(record: AccountProfilePersistenceRecord): AccountProfile {
    return {
      id: serializeId(record._id, 'account._id'),
      email: record.email,
      displayName: record.displayName,
      bio: record.bio,
      avatar: record.avatar,
      role: record.role,
      createdAt: record.createdAt,
      subscription: toSubscription(record.subscription),
    };
  }

  static toCredentials(record: AccountCredentialsPersistenceRecord): AccountCredentials {
    return {
      id: serializeId(record._id, 'account._id'),
      passwordHash: record.password,
    };
  }
}
