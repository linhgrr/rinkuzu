import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import type { AuthenticatedUser } from '@/entities/AuthAccount';
import { isAuthVersion } from '@/shared/constants/account-disable';

function stripSessionUser(session: Session): Session {
  const { user: _ignored, ...sessionWithoutUser } = session;
  void _ignored;
  return sessionWithoutUser;
}

function markSessionReplaced(session: Session): Session {
  return {
    ...stripSessionUser(session),
    invalidatedReason: 'session_replaced',
  };
}

export const clearSessionUser = stripSessionUser;

/** Edge-safe JWT to session projection. It never performs I/O. */
export function projectTokenToSession(session: Session, token: JWT): Session {
  const role = token.role;
  if (!token.sub || !session.user || (role !== 'admin' && role !== 'user')) {
    return stripSessionUser(session);
  }

  return {
    ...session,
    user: {
      id: token.sub,
      role,
      ...(session.user.name !== undefined ? { name: session.user.name } : {}),
      ...(session.user.email !== undefined ? { email: session.user.email } : {}),
      ...(session.user.image !== undefined ? { image: session.user.image } : {}),
      ...(typeof token.avatar === 'string' ? { avatar: token.avatar } : {}),
      ...(typeof token.displayName === 'string' ? { displayName: token.displayName } : {}),
    },
  };
}

/**
 * Fail-closed session hydration after a DB lookup.
 * Requires exact JWT `av` === database `authVersion` and active account.
 * Missing `av` always revokes. Password change newer than JWT also revokes.
 */
export function applySessionUser(
  session: Session,
  token: JWT,
  dbUser: AuthenticatedUser | null,
): Session {
  if (!token.sub || !dbUser) return stripSessionUser(session);

  if (!isAuthVersion(token.av)) return stripSessionUser(session);

  if (token.av !== dbUser.authVersion) {
    return markSessionReplaced(session);
  }

  const tokenPasswordChangedAt = typeof token.pwc === 'number' ? token.pwc : null;
  if (
    dbUser.passwordChangedAt &&
    (!tokenPasswordChangedAt || dbUser.passwordChangedAt > tokenPasswordChangedAt)
  ) {
    return stripSessionUser(session);
  }

  if (!session.user) return stripSessionUser(session);

  return {
    ...session,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      emailVerified: dbUser.emailVerified,
      ...(session.user.name !== undefined ? { name: session.user.name } : {}),
      ...(session.user.image !== undefined ? { image: session.user.image } : {}),
      ...(dbUser.avatar ? { avatar: dbUser.avatar } : {}),
      ...(dbUser.displayName ? { displayName: dbUser.displayName } : {}),
      ...(token.nac === true ? { isNewAccount: true as const } : {}),
    },
  };
}
