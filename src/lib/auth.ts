import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import connectDB from './mongoose';
import User from '@/models/User';
import { hashPassword, verifyPassword } from './password';
import { recordAuthEvent } from './audit';
import { loginSchema } from './validation/auth';

const isProd = process.env['NODE_ENV'] === 'production';

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_MAX_AGE_SECONDS = readPositiveIntEnv('SESSION_MAX_AGE_SECONDS', 8 * 60 * 60);
const SESSION_UPDATE_AGE_SECONDS = readPositiveIntEnv('SESSION_UPDATE_AGE_SECONDS', 60 * 60);

const LOCKOUT_MAX_ATTEMPTS = readPositiveIntEnv('AUTH_LOCKOUT_MAX_ATTEMPTS', 5);
const LOCKOUT_WINDOW_MS = readPositiveIntEnv('AUTH_LOCKOUT_WINDOW_MINUTES', 15) * 60_000;
const LOCKOUT_DURATION_MS = readPositiveIntEnv('AUTH_LOCKOUT_DURATION_MINUTES', 15) * 60_000;

// Pre-computed bcrypt hash of an unguessable random string. Used to keep the
// authorize() runtime constant when the email does not exist — frustrates
// timing-based user enumeration. Hash generated once at module load.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      `__rinkuzu_timing_decoy_${Math.random().toString(36)}_${Date.now()}__`,
    );
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
  process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']
    ? GoogleProvider({
        clientId: process.env['GOOGLE_CLIENT_ID'],
        clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
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
        const isValidPassword = await verifyPassword(parsed.data.password, passwordHash);

        if (!user || !isValidPassword) {
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

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              failedLoginAttempts: 0,
              failedLoginWindowStart: null,
              lockedUntil: null,
              lastLoginAt: now,
              lastLoginIp: ip,
            },
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
          avatar: user.avatar || '',
          displayName: user.displayName || '',
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

      const email = (profile as any)?.email?.toLowerCase().trim();
      const emailVerified =
        (profile as any)?.email_verified ?? (profile as any)?.emailVerified ?? false;

      if (!email || !emailVerified) {
        return false;
      }

      try {
        await connectDB();
        const update: Record<string, unknown> = {
          email,
          emailVerified: new Date(),
          isAnonymous: false,
        };
        const setOnInsert: Record<string, unknown> = {
          role: 'user',
        };
        if ((profile as any)?.name) update['displayName'] = (profile as any).name;
        if ((profile as any)?.picture) update['avatar'] = (profile as any).picture;

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
        console.error('Google signIn upsert failed:', error);
        return false;
      }
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.role = (user as any).role;
        token['avatar'] = (user as any).avatar;
        token['displayName'] = (user as any).displayName;
        token['pwc'] = (user as any).passwordChangedAt ?? null;
      }

      // Google sign-ins don't run our `authorize`, so user.id is the Google
      // sub. Fetch the Mongo user we just upserted and pin token.sub to it.
      if (account?.provider === 'google' && profile && typeof profile === 'object') {
        const email = (profile as any).email?.toLowerCase().trim();
        if (email) {
          try {
            await connectDB();
            const dbUser = await User.findOne({ email })
              .select('_id role avatar displayName passwordChangedAt')
              .lean<{
                _id: { toString(): string };
                role?: 'admin' | 'user';
                avatar?: string;
                displayName?: string;
                passwordChangedAt?: Date | null;
              }>();
            if (dbUser) {
              token.sub = dbUser._id.toString();
              token.role = dbUser.role ?? token.role;
              token['avatar'] = dbUser.avatar ?? token['avatar'];
              token['displayName'] = dbUser.displayName ?? token['displayName'];
              token['pwc'] = dbUser.passwordChangedAt
                ? new Date(dbUser.passwordChangedAt).getTime()
                : null;
            }
          } catch (error) {
            console.error('jwt-callback google lookup failed:', error);
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
            role?: 'admin' | 'user';
            avatar?: string;
            displayName?: string;
            email?: string;
          }>();

        if (!dbUser) {
          return { ...session, user: undefined as never };
        }

        const tokenPwc = typeof token['pwc'] === 'number' ? (token['pwc'] as number) : null;
        const dbPwc = dbUser.passwordChangedAt
          ? new Date(dbUser.passwordChangedAt).getTime()
          : null;

        if (dbPwc && (!tokenPwc || dbPwc > tokenPwc)) {
          return { ...session, user: undefined as never };
        }

        (session.user as any).id = token.sub;
        (session.user as any).role = dbUser.role ?? token.role;
        (session.user as any).avatar = dbUser.avatar ?? token['avatar'];
        (session.user as any).displayName = dbUser.displayName ?? token['displayName'];
        if (dbUser.email) (session.user as any).email = dbUser.email;
      } catch (error) {
        console.error('session-callback failed:', error);
        // Fail-closed on transient DB errors — drop the user payload.
        return { ...session, user: undefined as never };
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
  secret: process.env['NEXTAUTH_SECRET'],
};
