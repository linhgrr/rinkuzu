import type { PublicProfileUser, User } from '@/entities/User';
import { serializeId } from '@/lib/mongo-id';
import { mapEntitlementProjection } from '@/repositories/mappers/EntitlementProjectionPersistenceMapper';
import { mapOptionalEditableProfileFields } from '@/repositories/mappers/mapOptionalEditableProfileFields';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
} from '@/repositories/types/UserPersistence';
import {
  isAccountDisableState,
  type AccountDisableState,
} from '@/shared/constants/account-disable';

function requireDisable(value: unknown): AccountDisableState {
  if (!isAccountDisableState(value)) {
    throw new Error('user.disable must be exactly 0 or 1');
  }
  return value;
}

function mapOptionalDisabledBy(
  value: UserPersistenceRecord['disabledBy'],
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return serializeId(value, 'user.disabledBy');
}

export class UserPersistenceMapper {
  static toEntity(record: UserPersistenceRecord): User {
    const disable = requireDisable(record.disable);
    const disabledBy = mapOptionalDisabledBy(record.disabledBy);

    return {
      id: serializeId(record._id, 'user._id'),
      email: record.email,
      role: record.role,
      disable,
      createdAt: record.createdAt,
      ...(record.disabledAt === undefined ? {} : { disabledAt: record.disabledAt }),
      ...(disabledBy === undefined ? {} : { disabledBy }),
      ...(record.name === undefined ? {} : { name: record.name }),
      ...mapOptionalEditableProfileFields(record),
      ...(record.subscription === undefined
        ? {}
        : { subscription: mapEntitlementProjection(record.subscription) }),
    };
  }

  static toPublicProfile(record: PublicProfileUserPersistenceRecord): PublicProfileUser {
    return {
      id: serializeId(record._id, 'user._id'),
      createdAt: record.createdAt,
      ...(record.name === undefined ? {} : { name: record.name }),
      ...mapOptionalEditableProfileFields(record),
    };
  }
}
