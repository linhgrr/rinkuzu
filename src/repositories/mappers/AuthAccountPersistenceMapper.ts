import type { AuthAccountIdentity, AuthAccountSecurityState } from '@/entities/AuthAccount';
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
      ...(record.password === undefined ? {} : { passwordHash: record.password }),
      ...(record.emailVerified == null ? {} : { emailVerified: record.emailVerified }),
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
}
