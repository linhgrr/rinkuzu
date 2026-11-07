import type { AccountCredentials, AccountProfile, AccountSubscription } from '@/entities/Account';
import { serializeId } from '@/lib/mongo-id';
import { mapEntitlementProjection } from '@/repositories/mappers/EntitlementProjectionPersistenceMapper';
import { mapOptionalEditableProfileFields } from '@/repositories/mappers/mapOptionalEditableProfileFields';
import type {
  AccountCredentialsPersistenceRecord,
  AccountProfilePersistenceRecord,
  AccountSubscriptionPersistenceRecord,
} from '@/repositories/types/AccountPersistence';

function toSubscription(subscription: AccountSubscriptionPersistenceRecord): AccountSubscription {
  return mapEntitlementProjection(subscription);
}

export class AccountPersistenceMapper {
  static toProfile(record: AccountProfilePersistenceRecord): AccountProfile {
    return {
      id: serializeId(record._id, 'account._id'),
      email: record.email,
      role: record.role,
      createdAt: record.createdAt,
      ...mapOptionalEditableProfileFields(record),
      ...(record.subscription === undefined
        ? {}
        : { subscription: toSubscription(record.subscription) }),
      ...(record.hasPassword === undefined ? {} : { hasPassword: record.hasPassword }),
    };
  }

  static toCredentials(record: AccountCredentialsPersistenceRecord): AccountCredentials {
    return {
      id: serializeId(record._id, 'account._id'),
      ...(record.password === undefined ? {} : { passwordHash: record.password }),
    };
  }
}
