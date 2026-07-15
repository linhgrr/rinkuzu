import type {
  AuthAccountIdentity,
  AuthAccountSecurityState,
  AuthenticatedUser,
  AuthLoginAccount,
} from '@/entities/AuthAccount';
import { serializeId } from '@/lib/mongo-id';
import type { AuthAccountPersistenceRecord } from '@/repositories/types/AuthAccountPersistence';

type AuthAccountBase = AuthAccountIdentity &
  Pick<AuthAccountSecurityState, 'passwordHash' | 'emailVerified'>;

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
      ...AuthAccountPersistenceMapper.toBase(record),
      ...(record.emailVerificationTokenHash == null
        ? {}
        : { emailVerificationTokenHash: record.emailVerificationTokenHash }),
      ...(record.emailVerificationExpires == null
        ? {}
        : { emailVerificationExpires: record.emailVerificationExpires }),
      ...(record.passwordResetTokenHash == null
        ? {}
        : { passwordResetTokenHash: record.passwordResetTokenHash }),
      ...(record.passwordResetExpires == null
        ? {}
        : { passwordResetExpires: record.passwordResetExpires }),
    };
  }

  static toLoginAccount(record: AuthAccountPersistenceRecord): AuthLoginAccount {
    return {
      ...AuthAccountPersistenceMapper.toBase(record),
      ...(record.avatar == null ? {} : { avatar: record.avatar }),
      ...(record.displayName == null ? {} : { displayName: record.displayName }),
      ...(record.passwordChangedAt == null ? {} : { passwordChangedAt: record.passwordChangedAt }),
      failedLoginAttempts: record.failedLoginAttempts ?? 0,
      ...(record.failedLoginWindowStart == null
        ? {}
        : { failedLoginWindowStart: record.failedLoginWindowStart }),
      ...(record.lockedUntil == null ? {} : { lockedUntil: record.lockedUntil }),
    };
  }

  private static toBase(record: AuthAccountPersistenceRecord): AuthAccountBase {
    return {
      ...AuthAccountPersistenceMapper.toIdentity(record),
      ...(record.password === undefined ? {} : { passwordHash: record.password }),
      ...(record.emailVerified == null ? {} : { emailVerified: record.emailVerified }),
    };
  }

  static toAuthenticatedUser(record: AuthAccountPersistenceRecord): AuthenticatedUser {
    return {
      ...AuthAccountPersistenceMapper.toIdentity(record),
      ...(record.avatar == null ? {} : { avatar: record.avatar }),
      ...(record.displayName == null ? {} : { displayName: record.displayName }),
      passwordChangedAt: record.passwordChangedAt?.getTime() ?? null,
    };
  }
}
