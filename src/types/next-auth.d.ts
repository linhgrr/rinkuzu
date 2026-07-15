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
    /** Epoch milliseconds copied to JWT for password-reset revocation. */
    passwordChangedAt?: number | null;
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
  }
}
