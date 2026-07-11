import type {
  AuthAccountIdentity,
  AuthAccountSecurityState,
  AuthenticatedUser,
  AuthLoginAccount,
} from '@/entities/AuthAccount';
import { serializeId } from '@/lib/mongo-id';
import type { AuthAccountPersistenceRecord } from '@/repositories/types/AuthAccountPersistence';

export class AuthAccountPersistenceMapper {
  static toIdentity(record: AuthAccountPersistenceRecord): AuthAccountIdentity {
    return {
      id: serializeId(record._id, 'authAccount._id'),
      email: record.email,
      role: record.role,
    };
  }

  static toSecurityState(record: AuthAccountPersistenceRecord): AuthAccountSecurityState {
    return {
      ...AuthAccountPersistenceMapper.toIdentity(record),
      passwordHash: record.password,
      emailVerified: record.emailVerified ?? undefined,
      emailVerificationTokenHash: record.emailVerificationTokenHash ?? undefined,
      emailVerificationExpires: record.emailVerificationExpires ?? undefined,
      passwordResetTokenHash: record.passwordResetTokenHash ?? undefined,
      passwordResetExpires: record.passwordResetExpires ?? undefined,
    };
  }

  static toLoginAccount(record: AuthAccountPersistenceRecord): AuthLoginAccount {
    return {
      ...AuthAccountPersistenceMapper.toIdentity(record),
      passwordHash: record.password,
      emailVerified: record.emailVerified ?? undefined,
      avatar: record.avatar ?? undefined,
      displayName: record.displayName ?? undefined,
      passwordChangedAt: record.passwordChangedAt ?? undefined,
      failedLoginAttempts: record.failedLoginAttempts ?? 0,
      failedLoginWindowStart: record.failedLoginWindowStart ?? undefined,
      lockedUntil: record.lockedUntil ?? undefined,
    };
  }

  static toAuthenticatedUser(record: AuthAccountPersistenceRecord): AuthenticatedUser {
    return {
      ...AuthAccountPersistenceMapper.toIdentity(record),
      avatar: record.avatar ?? undefined,
      displayName: record.displayName ?? undefined,
      passwordChangedAt: record.passwordChangedAt?.getTime() ?? null,
    };
  }
}
