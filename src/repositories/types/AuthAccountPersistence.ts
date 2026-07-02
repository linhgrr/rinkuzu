import type { MongoIdLike } from '@/types/mongo';

export interface AuthAccountPersistenceRecord {
  _id: MongoIdLike;
  email: string;
  role: 'admin' | 'user';
  password?: string;
  emailVerified?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpires?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpires?: Date | null;
}
