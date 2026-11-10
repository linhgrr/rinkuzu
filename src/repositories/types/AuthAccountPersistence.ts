import type { MongoIdLike } from '@/types/mongo';

interface AuthIdentityPersistenceRecord {
  provider: string;
  subject: string;
}

export interface AuthAccountPersistenceRecord {
  _id: MongoIdLike;
  email: string;
  role: 'admin' | 'user';
  password?: string;
  authIdentities?: AuthIdentityPersistenceRecord[];
  emailVerified?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpires?: Date | null;
  guestClaimHashes?: string[];
  guestDraftHashes?: string[];
  passwordResetTokenHash?: string | null;
  passwordResetExpires?: Date | null;
  avatar?: string | null;
  displayName?: string | null;
  passwordChangedAt?: Date | null;
  authVersion?: number | null;
  failedLoginAttempts?: number | null;
  failedLoginWindowStart?: Date | null;
  lockedUntil?: Date | null;
}
