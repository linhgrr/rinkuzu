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
      passwordHash: record.password,
      emailVerified: record.emailVerified ?? undefined,
      emailVerificationTokenHash: record.emailVerificationTokenHash ?? undefined,
      emailVerificationExpires: record.emailVerificationExpires ?? undefined,
      passwordResetTokenHash: record.passwordResetTokenHash ?? undefined,
      passwordResetExpires: record.passwordResetExpires ?? undefined,
    };
  }
}
