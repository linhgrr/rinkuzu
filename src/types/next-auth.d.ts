import { DefaultSession } from 'next-auth';
import type { UserRole as SharedUserRole } from '@/shared/constants/user-role';

export type UserRole = SharedUserRole;

declare module 'next-auth' {
  interface Session {
    /** Set when a newer login has replaced the JWT's session generation. */
    invalidatedReason?: 'session_replaced';
    user?: {
      id: string;
      role: UserRole;
      /** Present after the database-backed session callback; absent on edge-only projection. */
      emailVerified?: boolean;
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
    /** Session generation copied to JWT as `av`. */
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
     * Session generation claim. Must exactly match database `authVersion`.
     * Missing or mismatched values fail closed and require re-login.
     */
    av?: number;
  }
}
