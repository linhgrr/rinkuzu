import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import type { AuthenticatedUser } from '@/entities/AuthAccount';

/** Edge-safe JWT → session (no DB). */
export function projectTokenToSession(session: Session, token: JWT): Session {
  const role = token.role;
  if (!token.sub || !session.user || (role !== 'admin' && role !== 'user')) {
    return { ...session, user: undefined };
  }

  session.user.id = token.sub;
  session.user.role = role;
  session.user.avatar = token.avatar;
  session.user.displayName = token.displayName;
  return session;
}

/**
 * Fail-closed session hydration after a DB lookup.
 * Returns stripped session when user missing or password was changed after token.pwc.
 */
export function applySessionUser(
  session: Session,
  token: JWT,
  dbUser: AuthenticatedUser | null,
): Session {
  if (!token.sub || !dbUser) {
    return { ...session, user: undefined };
  }

  const tokenPwc = typeof token.pwc === 'number' ? token.pwc : null;
  const dbPwc = dbUser.passwordChangedAt;
  if (dbPwc && (!tokenPwc || dbPwc > tokenPwc)) {
    return { ...session, user: undefined };
  }

  if (!session.user) {
    return { ...session, user: undefined };
  }

  session.user.id = dbUser.id;
  session.user.email = dbUser.email;
  session.user.role = dbUser.role;
  session.user.avatar = dbUser.avatar;
  session.user.displayName = dbUser.displayName;
  return session;
}
