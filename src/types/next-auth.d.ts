import { DefaultSession } from 'next-auth';

export type UserRole = 'admin' | 'user';

declare module 'next-auth' {
  interface Session {
    user?: {
      id: string;
      role: UserRole;
      avatar?: string;
      displayName?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: UserRole;
    avatar?: string;
    displayName?: string;
    /**
     * Durable Mongo account id for Google OAuth only.
     * Auth.js core overwrites `User.id` with a random UUID after profile();
     * `dbUserId` survives that overwrite and is selected into JWT `sub`/`id`.
     * Not projected onto Session.user.
     */
    dbUserId?: string;
    /** Epoch milliseconds copied to JWT for password-reset revocation. */
    passwordChangedAt?: number | null;
    /** Auth version copied to JWT as `av` for disable/restore revocation. */
    authVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: UserRole;
    avatar?: string;
    displayName?: string;
    /** Password change epoch; session is revoked when the DB value is newer. */
    pwc?: number | null;
    /**
     * Auth version claim. Must exactly match database `authVersion`.
     * Missing or mismatched values fail closed and require re-login.
     */
    av?: number;
  }
}
