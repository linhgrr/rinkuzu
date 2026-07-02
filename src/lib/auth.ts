import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { randomUUID } from 'node:crypto';

import connectDB from './mongoose';
import User from '@/models/User';
import { hashPassword, verifyPassword } from './password';
import { recordAuthEvent } from './audit';
import { buildSuccessfulLoginPasswordUpdate } from '@/lib/auth/password-rehash';
import { loginSchema } from './validation/auth';
import { env } from './env';
import type { UserRole } from '@/types/next-auth';
import { logger } from '@/lib/logger';

const isProd = env.NODE_ENV === 'production';

const SESSION_MAX_AGE_SECONDS = env.SESSION_MAX_AGE_SECONDS;
const SESSION_UPDATE_AGE_SECONDS = env.SESSION_UPDATE_AGE_SECONDS;

const LOCKOUT_MAX_ATTEMPTS = env.AUTH_LOCKOUT_MAX_ATTEMPTS;
const LOCKOUT_WINDOW_MS = env.AUTH_LOCKOUT_WINDOW_MINUTES * 60_000;
const LOCKOUT_DURATION_MS = env.AUTH_LOCKOUT_DURATION_MINUTES * 60_000;

type GoogleProfileClaims = {
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function parseGoogleProfileClaims(profile: unknown): GoogleProfileClaims {
  if (!isRecord(profile)) return {};

  return {
    email: readOptionalString(profile, 'email')?.toLowerCase(),
    emailVerified:
      readOptionalBoolean(profile, 'email_verified') ??
      readOptionalBoolean(profile, 'emailVerified'),
    name: readOptionalString(profile, 'name'),
    picture: readOptionalString(profile, 'picture'),
  };
}

// Pre-computed Argon2id hash of an unguessable random string. Used to keep the
// authorize() runtime constant when the email does not exist — frustrates
// timing-based user enumeration. Hash generated once at module load.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(`__rinkuzu_timing_decoy_${randomUUID()}_${Date.now()}__`);
  }
  return dummyHashPromise;
}

class AuthError extends Error {
  // NextAuth surfaces `error.message` as the query-string `error` param on the
  // sign-in callback. Use the machine-readable code as the message so the
  // client can branch on it; human-readable copy lives in i18n keyed by code.
  constructor(
    public code: string,
    public meta?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
      })
    : null;

export const isGoogleLoginEnabled = Boolean(googleProvider);

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) {
          throw new AuthError('invalid_credentials');
        }

        const ip =
          (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
          (req?.headers?.['x-real-ip'] as string | undefined) ||
          null;
        const userAgent = (req?.headers?.['user-agent'] as string | undefined) ?? null;

        await connectDB();

        const user = await User.findOne({ email: parsed.data.email });
        const now = new Date();

        if (user?.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
          await recordAuthEvent({
            event: 'login_locked',
            userId: user._id,
            email: user.email,
            ip,
            userAgent,
          });
          throw new AuthError('account_locked', { lockedUntil: user.lockedUntil.toISOString() });
        }

        const passwordHash = user?.password ?? (await getDummyHash());
        const passwordVerification = await verifyPassword(parsed.data.password, passwordHash);

        if (!user || !passwordVerification.valid) {
          if (user) {
            const windowStart = user.failedLoginWindowStart;
            const windowExpired =
              !windowStart || now.getTime() - windowStart.getTime() > LOCKOUT_WINDOW_MS;
            const nextAttempts = windowExpired ? 1 : (user.failedLoginAttempts ?? 0) + 1;

            const updates: Record<string, unknown> = {
              failedLoginAttempts: nextAttempts,
              ...(windowExpired ? { failedLoginWindowStart: now } : {}),
            };

            if (nextAttempts >= LOCKOUT_MAX_ATTEMPTS) {
              updates['lockedUntil'] = new Date(now.getTime() + LOCKOUT_DURATION_MS);
              updates['failedLoginAttempts'] = 0;
              updates['failedLoginWindowStart'] = null;
            }

            await User.updateOne({ _id: user._id }, { $set: updates });

            await recordAuthEvent({
              event: nextAttempts >= LOCKOUT_MAX_ATTEMPTS ? 'account_locked' : 'login_failed',
              userId: user._id,
              email: user.email,
              ip,
              userAgent,
              metadata: { attempts: nextAttempts },
            });
          } else {
            await recordAuthEvent({
              event: 'login_failed',
              email: parsed.data.email,
              ip,
              userAgent,
              metadata: { reason: 'unknown_user' },
            });
          }

          throw new AuthError('invalid_credentials');
        }

        const successfulLoginUpdate: Record<string, unknown> = {
          failedLoginAttempts: 0,
          failedLoginWindowStart: null,
          lockedUntil: null,
          lastLoginAt: now,
          lastLoginIp: ip,
        };

        if (passwordVerification.needsRehash) {
          Object.assign(
            successfulLoginUpdate,
            await buildSuccessfulLoginPasswordUpdate(parsed.data.password, passwordVerification),
          );
        }

        await User.updateOne(
          { _id: user._id },
          {
            $set: successfulLoginUpdate,
          },
        );

        if (!user.emailVerified) {
          await recordAuthEvent({
            event: 'login_failed',
            userId: user._id,
            email: user.email,
            ip,
            userAgent,
            metadata: { reason: 'email_not_verified' },
          });
          throw new AuthError('email_not_verified', { email: user.email });
        }

        await recordAuthEvent({
          event: 'login_success',
          userId: user._id,
          email: user.email,
          ip,
          userAgent,
        });

        return {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          ...(user.avatar ? { avatar: user.avatar } : {}),
          ...(user.displayName ? { displayName: user.displayName } : {}),
          passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.getTime() : null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: isProd ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
      },
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Only special-case Google. Credentials flow is fully handled in authorize().
      if (account?.provider !== 'google') return true;

      const googleProfile = parseGoogleProfileClaims(profile);
      const email = googleProfile.email;

      if (!email || !googleProfile.emailVerified) {
        return false;
      }

      try {
        await connectDB();
        const update: Record<string, unknown> = {
          email,
          emailVerified: new Date(),
        };
        const setOnInsert: Record<string, unknown> = {
          role: 'user',
        };
        if (googleProfile.name) update['displayName'] = googleProfile.name;
        if (googleProfile.picture) update['avatar'] = googleProfile.picture;

        const user = await User.findOneAndUpdate(
          { email },
          { $set: update, $setOnInsert: setOnInsert },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        await recordAuthEvent({
          event: 'login_success',
          userId: user._id,
          email: user.email,
          metadata: { provider: 'google' },
        });
        return true;
      } catch (error) {
        logger.error({ error }, 'Google signIn upsert failed');
        return false;
      }
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        const u = user as {
          role?: UserRole;
          avatar?: string;
          displayName?: string;
          passwordChangedAt?: number | null;
        };
        if (u.role) token.role = u.role;
        if (u.avatar !== undefined) token.avatar = u.avatar;
        if (u.displayName !== undefined) token.displayName = u.displayName;
        token.pwc = u.passwordChangedAt ?? null;
      }

      // Google sign-ins don't run our `authorize`, so user.id is the Google
      // sub. Fetch the Mongo user we just upserted and pin token.sub to it.
      if (account?.provider === 'google' && profile && typeof profile === 'object') {
        const email = parseGoogleProfileClaims(profile).email;
        if (email) {
          try {
            await connectDB();
            const dbUser = await User.findOne({ email })
              .select('_id role avatar displayName passwordChangedAt')
              .lean<{
                _id: { toString(): string };
                role?: UserRole;
                avatar?: string;
                displayName?: string;
                passwordChangedAt?: Date | null;
              }>();
            if (dbUser) {
              token.sub = dbUser._id.toString();
              if (dbUser.role) token.role = dbUser.role;
              if (dbUser.avatar !== undefined) token.avatar = dbUser.avatar;
              if (dbUser.displayName !== undefined) token.displayName = dbUser.displayName;
              token.pwc = dbUser.passwordChangedAt
                ? new Date(dbUser.passwordChangedAt).getTime()
                : null;
            }
          } catch (error) {
            logger.error({ error }, 'jwt-callback google lookup failed');
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.sub) return session;

      // Revoke-on-reset: if the user's passwordChangedAt is newer than the JWT
      // issuance / stamp, treat the session as invalid and return a stripped
      // session so callers see "no user".
      try {
        await connectDB();
        const dbUser = await User.findById(token.sub)
          .select('passwordChangedAt role avatar displayName email')
          .lean<{
            passwordChangedAt?: Date | null;
            role?: UserRole;
            avatar?: string;
            displayName?: string;
            email?: string;
          }>();

        if (!dbUser) {
          return { ...session, user: undefined };
        }

        const tokenPwc = typeof token.pwc === 'number' ? token.pwc : null;
        const dbPwc = dbUser.passwordChangedAt
          ? new Date(dbUser.passwordChangedAt).getTime()
          : null;

        if (dbPwc && (!tokenPwc || dbPwc > tokenPwc)) {
          return { ...session, user: undefined };
        }

        if (!session.user) {
          return { ...session, user: undefined };
        }
        session.user.id = token.sub;
        session.user.role = dbUser.role ?? token.role;
        session.user.avatar = dbUser.avatar ?? token.avatar;
        session.user.displayName = dbUser.displayName ?? token.displayName;
        if (dbUser.email) session.user.email = dbUser.email;
      } catch (error) {
        logger.error({ error }, 'session-callback failed');
        // Fail-closed on transient DB errors — drop the user payload.
        return { ...session, user: undefined };
      }

      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sub) {
        await recordAuthEvent({
          event: 'logout',
          userId: token.sub,
          email: typeof token.email === 'string' ? token.email : null,
        });
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: env.NEXTAUTH_SECRET,
};
