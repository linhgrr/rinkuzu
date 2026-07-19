import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import authConfig from '@/auth.config';
import { extractRequestContext } from '@/lib/audit';
import { getAuthSignInRepository, getAuthSignInService } from '@/lib/auth-sign-in-factory';
import { selectAuthDbUserId } from '@/lib/auth/auth-db-identity';
import { applySessionUser, clearSessionUser } from '@/lib/auth/session-projection';
import { env } from '@/lib/env';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';
import { logger } from '@/lib/logger';
import { loginSchema } from '@/lib/validation/auth';
import { toCredentialsSignInError } from '@/services/auth/CredentialsSignInErrors';
import { isAuthVersion } from '@/shared/constants/account-disable';

const logoutAudit = new AuthAuditAdapter();
const logoutScheduler = new NextDeferredTaskScheduler();

type GoogleProfile = {
  /** Canonical nonempty Google subject; becomes Auth.js providerAccountId. */
  sub: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatar?: string;
};

type AuthJsUserClaimsSource = {
  email: string;
  role: 'admin' | 'user';
  avatar?: string;
  displayName?: string;
  passwordChangedAt: number | null;
  authVersion: number;
};

function readTrimmedString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parses Google OIDC profile fields. Requires a nonempty `sub` so Auth.js can
 * store a stable providerAccountId; fails closed when sub is missing.
 */
function parseGoogleProfile(profile: unknown): GoogleProfile | null {
  if (typeof profile !== 'object' || profile === null) {
    return null;
  }

  const record = profile as Record<string, unknown>;
  const sub = readTrimmedString(record, 'sub');
  if (!sub) return null;

  const email = readTrimmedString(record, 'email')?.toLowerCase();
  const displayName = readTrimmedString(record, 'name');
  const avatar = readTrimmedString(record, 'picture');

  return {
    sub,
    ...(email ? { email } : {}),
    emailVerified: record['email_verified'] === true,
    ...(displayName ? { displayName } : {}),
    ...(avatar ? { avatar } : {}),
  };
}

function toAuthJsUserClaims(user: AuthJsUserClaimsSource) {
  return {
    email: user.email,
    role: user.role,
    ...(user.avatar ? { avatar: user.avatar } : {}),
    ...(user.displayName ? { displayName: user.displayName } : {}),
    passwordChangedAt: user.passwordChangedAt,
    authVersion: user.authVersion,
  };
}

function clearAuthTokenClaims(token: Record<string, unknown>): void {
  delete token['sub'];
  delete token['id'];
  delete token['role'];
  delete token['avatar'];
  delete token['displayName'];
  delete token['pwc'];
  delete token['av'];
  delete token['email'];
}

function assignAuthenticatedClaims(
  token: Record<string, unknown>,
  user: {
    id: string;
    email: string;
    role: 'admin' | 'user';
    avatar?: string;
    displayName?: string;
    passwordChangedAt: number | null;
    authVersion: number;
  },
): void {
  token['sub'] = user.id;
  token['id'] = user.id;
  token['role'] = user.role;
  token['email'] = user.email;
  token['pwc'] = user.passwordChangedAt;
  token['av'] = user.authVersion;
  if (user.avatar) token['avatar'] = user.avatar;
  else delete token['avatar'];
  if (user.displayName) token['displayName'] = user.displayName;
  else delete token['displayName'];
}

const providers = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials, request) {
      const parsed = loginSchema.safeParse({
        email: credentials?.['email'],
        password: credentials?.['password'],
      });
      if (!parsed.success) {
        throw toCredentialsSignInError({ success: false, code: 'invalid_credentials' });
      }

      const context = request ? extractRequestContext(request) : { ip: null, userAgent: null };
      const result = await getAuthSignInService().authenticateCredentials(parsed.data, context);
      if (!result.success) throw toCredentialsSignInError(result);

      // Credentials: repository user.id is the durable Mongo id (Auth.js keeps it).
      return {
        id: result.user.id,
        ...toAuthJsUserClaims(result.user),
      };
    },
  }),
  ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
          authorization: {
            params: {
              prompt: 'consent',
              access_type: 'offline',
              response_type: 'code',
            },
          },
          async profile(profile) {
            const google = parseGoogleProfile(profile);
            if (!google?.email || !google.emailVerified) {
              throw new Error('Google email is missing or not verified');
            }

            // Exactly one repository upsert path for Google — never from jwt/adapter.
            const result = await getAuthSignInService().authenticateGoogle(
              {
                email: google.email,
                emailVerified: true,
                ...(google.displayName ? { displayName: google.displayName } : {}),
                ...(google.avatar ? { avatar: google.avatar } : {}),
              },
              { ip: null, userAgent: null },
            );

            if (!result.success) {
              throw new Error('Google authentication rejected');
            }

            // Auth core overwrites `id` with randomUUID and uses the returned id as
            // providerAccountId. Return Google sub as id; carry Mongo id as dbUserId.
            return {
              id: google.sub,
              dbUserId: result.user.id,
              name: result.user.displayName ?? result.user.email,
              image: result.user.avatar,
              ...toAuthJsUserClaims(result.user),
            };
          },
        }),
      ]
    : []),
];

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, user }) {
      if (account?.provider === 'google') {
        // Fail closed: Google must present durable dbUserId + authVersion.
        // Never accept Auth core's random user.id as the session subject.
        const dbUserId = selectAuthDbUserId(account.provider, user);
        if (!dbUserId || !isAuthVersion(user.authVersion)) return false;
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        const provider = account?.provider ?? 'credentials';
        const dbUserId = selectAuthDbUserId(provider, user);
        if (!dbUserId || !isAuthVersion(user.authVersion)) {
          clearAuthTokenClaims(token as Record<string, unknown>);
          return token;
        }

        assignAuthenticatedClaims(token as Record<string, unknown>, {
          id: dbUserId,
          email: typeof user.email === 'string' ? user.email : '',
          role: user.role,
          ...(user.avatar ? { avatar: user.avatar } : {}),
          ...(user.displayName ? { displayName: user.displayName } : {}),
          passwordChangedAt: user.passwordChangedAt ?? null,
          authVersion: user.authVersion,
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub) return clearSessionUser(session);

      try {
        const dbUser = await getAuthSignInRepository().findSessionUser(token.sub);
        return applySessionUser(session, token, dbUser);
      } catch (error) {
        logger.error({ error }, 'session-callback failed');
        return clearSessionUser(session);
      }
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : undefined;
      const userId = token?.sub;
      if (!userId) return;

      logoutScheduler.schedule(() =>
        logoutAudit.record({
          event: 'logout',
          userId,
          ...(typeof token.email === 'string' ? { email: token.email } : {}),
          ip: null,
          userAgent: null,
        }),
      );
    },
  },
});
