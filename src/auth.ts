import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import authConfig from '@/auth.config';
import { getAuthSignInRepository, getAuthSignInService } from '@/lib/auth-sign-in-factory';
import { applySessionUser } from '@/lib/auth/session-projection';
import { extractRequestContext } from '@/lib/audit';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { loginSchema } from '@/lib/validation/auth';
import { toCredentialsSignInError } from '@/services/auth/CredentialsSignInErrors';

const logoutAudit = new AuthAuditAdapter();
const logoutScheduler = new NextDeferredTaskScheduler();

function parseGoogleProfile(profile: unknown): {
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatar?: string;
} {
  if (typeof profile !== 'object' || profile === null) {
    return { emailVerified: false };
  }
  const p = profile as Record<string, unknown>;
  const email = typeof p['email'] === 'string' ? p['email'].trim().toLowerCase() : undefined;
  return {
    email: email && email.length > 0 ? email : undefined,
    emailVerified: p['email_verified'] === true,
    displayName: typeof p['name'] === 'string' && p['name'].trim() ? p['name'].trim() : undefined,
    avatar:
      typeof p['picture'] === 'string' && p['picture'].trim() ? p['picture'].trim() : undefined,
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
      if (!result.success) {
        throw toCredentialsSignInError(result);
      }

      return {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        avatar: result.user.avatar,
        displayName: result.user.displayName,
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
      // Google: one upsert, Mongo id becomes JWT subject. No second lookup.
      if (account?.provider === 'google') {
        const google = parseGoogleProfile(profile);
        const result = await getAuthSignInService().authenticateGoogle(
          {
            email: google.email,
            emailVerified: google.emailVerified,
            displayName: google.displayName,
            avatar: google.avatar,
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
        token.role = result.user.role;
        token.avatar = result.user.avatar;
        token.displayName = result.user.displayName;
        token.pwc = result.user.passwordChangedAt;
        token.email = result.user.email;
        return token;
      }

      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.avatar = user.avatar;
        token.displayName = user.displayName;
        token.email = user.email;
        token.pwc = user.passwordChangedAt ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub) {
        return { ...session, user: undefined };
      }
      try {
        const dbUser = await getAuthSignInRepository().findSessionUser(token.sub);
        return applySessionUser(session, token, dbUser);
      } catch (error) {
        logger.error({ error }, 'session-callback failed');
        return { ...session, user: undefined };
      }
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : undefined;
      if (!token?.sub) return;
      logoutScheduler.schedule(() =>
        logoutAudit.record({
          event: 'logout',
          userId: token.sub,
          email: typeof token.email === 'string' ? token.email : undefined,
          ip: null,
          userAgent: null,
        }),
      );
    },
  },
});
