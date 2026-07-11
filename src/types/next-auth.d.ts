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
    /** Epoch ms stamp copied into JWT `pwc` on credentials sign-in. */
    passwordChangedAt?: number | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
    avatar?: string;
    displayName?: string;
    /** passwordChangedAt epoch ms; session revoked when DB value is newer. */
    pwc?: number | null;
  }
}
