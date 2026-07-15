import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import authConfig from '@/auth.config';
import { extractRequestContext } from '@/lib/audit';
import { getAuthSignInRepository, getAuthSignInService } from '@/lib/auth-sign-in-factory';
import { applySessionUser, clearSessionUser } from '@/lib/auth/session-projection';
import { env } from '@/lib/env';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';
import { logger } from '@/lib/logger';
import { loginSchema } from '@/lib/validation/auth';
import { toCredentialsSignInError } from '@/services/auth/CredentialsSignInErrors';

const logoutAudit = new AuthAuditAdapter();
const logoutScheduler = new NextDeferredTaskScheduler();

type GoogleProfile = {
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatar?: string;
};

function readTrimmedString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseGoogleProfile(profile: unknown): GoogleProfile {
  if (typeof profile !== 'object' || profile === null) {
    return { emailVerified: false };
  }

  const record = profile as Record<string, unknown>;
  const email = readTrimmedString(record, 'email')?.toLowerCase();
  const displayName = readTrimmedString(record, 'name');
  const avatar = readTrimmedString(record, 'picture');

  return {
    ...(email ? { email } : {}),
    emailVerified: record['email_verified'] === true,
    ...(displayName ? { displayName } : {}),
    ...(avatar ? { avatar } : {}),
  };
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

      return {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        ...(result.user.avatar ? { avatar: result.user.avatar } : {}),
        ...(result.user.displayName ? { displayName: result.user.displayName } : {}),
        passwordChangedAt: result.user.passwordChangedAt,
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
        }),
      ]
    : []),
];

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      const google = parseGoogleProfile(profile);
      return Boolean(google.email && google.emailVerified);
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const google = parseGoogleProfile(profile);
        const result = await getAuthSignInService().authenticateGoogle(
          {
            ...(google.email ? { email: google.email } : {}),
            emailVerified: google.emailVerified,
            ...(google.displayName ? { displayName: google.displayName } : {}),
            ...(google.avatar ? { avatar: google.avatar } : {}),
          },
          { ip: null, userAgent: null },
        );

        if (!result.success) {
          logger.warn({ code: result.code }, 'Google sign-in rejected');
          delete token.sub;
          delete token.role;
          delete token.avatar;
          delete token.displayName;
          delete token.pwc;
          delete token.email;
          return token;
        }

        token.sub = result.user.id;
        token.id = result.user.id;
        token.role = result.user.role;
        token.email = result.user.email;
        token.pwc = result.user.passwordChangedAt;
        if (result.user.avatar) token.avatar = result.user.avatar;
        else delete token.avatar;
        if (result.user.displayName) token.displayName = result.user.displayName;
        else delete token.displayName;
        return token;
      }

      if (user) {
        token.sub = user.id;
        token.id = user.id;
        token.role = user.role;
        token.pwc = user.passwordChangedAt ?? null;
        if (typeof user.email === 'string') token.email = user.email;
        else delete token.email;
        if (user.avatar) token.avatar = user.avatar;
        else delete token.avatar;
        if (user.displayName) token.displayName = user.displayName;
        else delete token.displayName;
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
