/**
 * Production Auth.js config capture tests.
 *
 * Imports the real `src/auth.ts` after module mocks so we exercise the
 * Google provider profile + callbacks.signIn/jwt/session that production
 * installs — not a local copy of that logic.
 *
 * Identity selection (`selectAuthDbUserId`) and session projection
 * (`applySessionUser` / `clearSessionUser`) are intentionally real modules
 * imported transitively by production `src/auth.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateCredentialsMock,
  authenticateGoogleMock,
  findSessionUserMock,
  rememberSignInLocaleMock,
  signInRepository,
  nextAuthConfig,
} = vi.hoisted(() => {
  const nextAuthConfig: { current: Record<string, unknown> | null } = { current: null };
  const findSessionUserMock = vi.fn();
  return {
    authenticateCredentialsMock: vi.fn(),
    authenticateGoogleMock: vi.fn(),
    findSessionUserMock,
    rememberSignInLocaleMock: vi.fn(),
    signInRepository: { findSessionUser: findSessionUserMock },
    nextAuthConfig,
  };
});

vi.mock('next-auth', () => ({
  default: (config: Record<string, unknown>) => {
    nextAuthConfig.current = config;
    return {
      auth: vi.fn(),
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  },
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: (options: Record<string, unknown>) => ({ id: 'credentials', ...options }),
}));

vi.mock('next-auth/providers/google', () => ({
  default: (options: Record<string, unknown>) => ({ id: 'google', ...options }),
}));

vi.mock('@/auth.config', () => ({
  default: {
    providers: [],
    callbacks: {
      redirect: ({ url }: { url: string }) => url,
      session: ({ session }: { session: unknown }) => session,
    },
    pages: { signIn: '/login', error: '/login' },
    session: { strategy: 'jwt' },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_GOOGLE_ID: 'google-client-id',
    AUTH_GOOGLE_SECRET: 'google-client-secret',
  },
}));

vi.mock('@/lib/audit', () => ({
  extractRequestContext: () => ({ ip: null, userAgent: null }),
}));

vi.mock('@/lib/auth-sign-in-factory', () => ({
  getAuthSignInService: () => ({
    authenticateCredentials: authenticateCredentialsMock,
    authenticateGoogle: authenticateGoogleMock,
  }),
  getAuthSignInRepository: () => signInRepository,
}));

vi.mock('@/lib/auth/remember-sign-in-locale', () => ({
  rememberSignInLocale: rememberSignInLocaleMock,
}));

vi.mock('@/lib/integrations/auth-audit', () => ({
  AuthAuditAdapter: class {
    record = vi.fn();
  },
}));

vi.mock('@/lib/integrations/next-deferred-task-scheduler', () => ({
  NextDeferredTaskScheduler: class {
    schedule = vi.fn((task: () => unknown) => {
      void task;
    });
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/services/auth/CredentialsSignInErrors', () => ({
  toCredentialsSignInError: (result: { code: string }) => {
    const error = new Error(result.code);
    (error as { code?: string }).code = result.code;
    return error;
  },
}));

// Real production module under test — after mocks.
// Real selectAuthDbUserId / applySessionUser / clearSessionUser load transitively.
await import('@/auth');

type GoogleProvider = {
  id: string;
  profile: (profile: unknown) => Promise<Record<string, unknown>>;
};

type CredentialsProvider = {
  id: string;
  authorize: (
    credentials: Record<string, unknown> | undefined,
    request: Request,
  ) => Promise<Record<string, unknown>>;
};

type AuthCallbacks = {
  signIn: (args: {
    account?: { provider?: string } | null;
    user: Record<string, unknown>;
  }) => Promise<boolean>;
  jwt: (args: {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
    account?: { provider?: string } | null;
  }) => Promise<Record<string, unknown>>;
  session: (args: {
    session: Record<string, unknown>;
    token: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
};

function capturedConfig(): {
  providers: Array<GoogleProvider | CredentialsProvider>;
  callbacks: AuthCallbacks;
} {
  if (!nextAuthConfig.current) {
    throw new Error('NextAuth config was not captured');
  }
  return nextAuthConfig.current as {
    providers: Array<GoogleProvider | CredentialsProvider>;
    callbacks: AuthCallbacks;
  };
}

function googleProvider(): GoogleProvider {
  const provider = capturedConfig().providers.find((entry) => entry.id === 'google');
  if (!provider || !('profile' in provider)) {
    throw new Error('Google provider missing from production Auth.js config');
  }
  return provider as GoogleProvider;
}

function credentialsProvider(): CredentialsProvider {
  const provider = capturedConfig().providers.find((entry) => entry.id === 'credentials');
  if (!provider || !('authorize' in provider)) {
    throw new Error('Credentials provider missing from production Auth.js config');
  }
  return provider as CredentialsProvider;
}

describe('production Auth.js config (src/auth.ts)', () => {
  beforeEach(() => {
    authenticateCredentialsMock.mockReset();
    authenticateGoogleMock.mockReset();
    findSessionUserMock.mockReset();
    rememberSignInLocaleMock.mockReset();
  });

  it('rejects Google profiles without a nonempty sub', async () => {
    await expect(
      googleProvider().profile({
        email: 'learner@example.com',
        email_verified: true,
        name: 'Learner',
      }),
    ).rejects.toThrow(/Google email is missing or not verified|missing/i);

    // Missing sub → parseGoogleProfile null → throw on email path.
    await expect(
      googleProvider().profile({
        sub: '   ',
        email: 'learner@example.com',
        email_verified: true,
      }),
    ).rejects.toThrow();
    expect(authenticateGoogleMock).not.toHaveBeenCalled();
  });

  it('Google profile returns Google sub as id and Mongo id as dbUserId', async () => {
    authenticateGoogleMock.mockResolvedValueOnce({
      success: true,
      user: {
        id: '507f191e810c19729de860ea',
        email: 'learner@example.com',
        role: 'user',
        displayName: 'Learner',
        avatar: 'https://cdn.example/a.png',
        passwordChangedAt: null,
        authVersion: 2,
      },
      isNewAccount: true,
    });

    const profile = await googleProvider().profile({
      sub: 'google-sub-001',
      email: 'learner@example.com',
      email_verified: true,
      name: 'Learner',
      picture: 'https://cdn.example/a.png',
    });

    expect(authenticateGoogleMock).toHaveBeenCalledOnce();
    expect(profile).toMatchObject({
      id: 'google-sub-001',
      dbUserId: '507f191e810c19729de860ea',
      email: 'learner@example.com',
      role: 'user',
      authVersion: 2,
      passwordChangedAt: null,
      isNewAccount: true,
    });
    // Must not prefer Auth core UUID shape as the Mongo subject.
    expect(profile['id']).not.toBe(profile['dbUserId']);
    // RIN-1263: the Mongo account gets the request locale (callback cookie) if it has none.
    expect(rememberSignInLocaleMock).toHaveBeenCalledWith(
      signInRepository,
      '507f191e810c19729de860ea',
    );
  });

  it('signIn requires dbUserId + authVersion for Google and accepts credentials', async () => {
    const { callbacks } = capturedConfig();

    // Google without dbUserId → real selectAuthDbUserId returns null → reject.
    await expect(
      callbacks.signIn({
        account: { provider: 'google' },
        user: { id: 'uuid-core', authVersion: 0 },
      }),
    ).resolves.toBe(false);

    // Google with empty dbUserId → real selector fails closed → reject.
    await expect(
      callbacks.signIn({
        account: { provider: 'google' },
        user: { id: 'uuid-core', dbUserId: '', authVersion: 0 },
      }),
    ).resolves.toBe(false);

    // Google with durable dbUserId + valid authVersion → accept.
    await expect(
      callbacks.signIn({
        account: { provider: 'google' },
        user: {
          id: 'google-sub',
          dbUserId: '507f191e810c19729de860ea',
          authVersion: 1,
        },
      }),
    ).resolves.toBe(true);

    // Google with invalid authVersion → reject even when dbUserId is present.
    await expect(
      callbacks.signIn({
        account: { provider: 'google' },
        user: {
          id: 'google-sub',
          dbUserId: '507f191e810c19729de860ea',
          authVersion: -1,
        },
      }),
    ).resolves.toBe(false);

    // Credentials: production only requires Google identity checks; other providers pass.
    await expect(
      callbacks.signIn({
        account: { provider: 'credentials' },
        user: { id: '507f191e810c19729de860ea' },
      }),
    ).resolves.toBe(true);
  });

  it('jwt assigns Mongo id/av for credentials and Google, clears on invalid input', async () => {
    const { callbacks } = capturedConfig();

    // Credentials: real selector uses user.id as durable Mongo subject.
    const credToken = await callbacks.jwt({
      token: { email: 'a@example.com' },
      user: {
        id: 'mongo-cred-1',
        email: 'a@example.com',
        role: 'user',
        passwordChangedAt: 100,
        authVersion: 0,
      },
      account: { provider: 'credentials' },
    });
    expect(credToken).toMatchObject({
      sub: 'mongo-cred-1',
      id: 'mongo-cred-1',
      role: 'user',
      av: 0,
      pwc: 100,
      email: 'a@example.com',
    });

    // Google: real selector uses user.dbUserId, not provider sub / Auth core id.
    const googleToken = await callbacks.jwt({
      token: {},
      user: {
        id: 'google-sub',
        dbUserId: 'mongo-google-1',
        email: 'g@example.com',
        role: 'admin',
        passwordChangedAt: null,
        authVersion: 4,
        displayName: 'G',
        isNewAccount: true,
      },
      account: { provider: 'google' },
    });
    expect(googleToken).toMatchObject({
      sub: 'mongo-google-1',
      id: 'mongo-google-1',
      role: 'admin',
      av: 4,
      pwc: null,
      displayName: 'G',
      nac: true,
    });
    expect(credToken['nac']).toBeUndefined();
    // Google must select Mongo id, not Auth core / provider UUID.
    expect(googleToken['sub']).not.toBe('google-sub');

    // Google without dbUserId → real selector null → clear claims.
    const cleared = await callbacks.jwt({
      token: {
        sub: 'stale',
        id: 'stale',
        role: 'user',
        av: 1,
        pwc: 1,
        email: 'x@example.com',
        avatar: 'a',
        displayName: 'X',
        nac: true,
      },
      user: { id: 'uuid', authVersion: 0 },
      account: { provider: 'google' },
    });
    expect(cleared['sub']).toBeUndefined();
    expect(cleared['id']).toBeUndefined();
    expect(cleared['role']).toBeUndefined();
    expect(cleared['av']).toBeUndefined();
    expect(cleared['pwc']).toBeUndefined();
    expect(cleared['email']).toBeUndefined();
    expect(cleared['avatar']).toBeUndefined();
    expect(cleared['displayName']).toBeUndefined();
    expect(cleared['nac']).toBeUndefined();
  });

  it('keeps existing claims during a JWT refresh without a user payload', async () => {
    const token = {
      sub: 'mongo-existing',
      id: 'mongo-existing',
      email: 'existing@example.com',
      role: 'user',
      av: 3,
    };

    await expect(capturedConfig().callbacks.jwt({ token })).resolves.toBe(token);
  });

  it('session hydrates on active av match and clears on mismatch/disabled/null', async () => {
    const { callbacks } = capturedConfig();
    const baseSession = {
      expires: '2099-01-01T00:00:00.000Z',
      user: { id: 'placeholder', email: 'p@example.com', role: 'user' },
    };
    const activeDbUser = {
      id: 'mongo-1',
      email: 'user@example.com',
      role: 'user' as const,
      authVersion: 3,
      passwordChangedAt: null,
    };

    // Missing sub → real clearSessionUser strips user.
    const missingSub = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: {},
    });
    expect(missingSub['user']).toBeUndefined();
    expect(findSessionUserMock).not.toHaveBeenCalled();

    // Active DB user with equal av → real applySessionUser hydrates.
    findSessionUserMock.mockResolvedValueOnce(activeDbUser);
    const hydrated = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', av: 3, role: 'user' },
    });
    expect(findSessionUserMock).toHaveBeenCalledWith('mongo-1');
    expect(hydrated['user']).toMatchObject({
      id: 'mongo-1',
      email: 'user@example.com',
      role: 'user',
    });
    expect(hydrated['user']).not.toHaveProperty('isNewAccount');

    // A JWT minted by a Google sign-in that created the account exposes the flag.
    findSessionUserMock.mockResolvedValueOnce(activeDbUser);
    const newGoogleAccount = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', av: 3, role: 'user', nac: true },
    });
    expect(newGoogleAccount['user']).toMatchObject({ id: 'mongo-1', isNewAccount: true });

    // Same DB user with mismatched av → real applySessionUser clears.
    findSessionUserMock.mockResolvedValueOnce(activeDbUser);
    const avMismatch = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', av: 2, role: 'user' },
    });
    expect(avMismatch['user']).toBeUndefined();

    // Missing av → real applySessionUser fails closed and clears.
    findSessionUserMock.mockResolvedValueOnce(activeDbUser);
    const missingAv = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', role: 'user' },
    });
    expect(missingAv['user']).toBeUndefined();

    // findSessionUser null (disabled/missing) → real applySessionUser clears.
    findSessionUserMock.mockResolvedValueOnce(null);
    const disabled = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', av: 3, role: 'user' },
    });
    expect(disabled['user']).toBeUndefined();

    // Repository exception → production catch path uses real clearSessionUser.
    findSessionUserMock.mockRejectedValueOnce(new Error('db down'));
    const repoError = await callbacks.session({
      session: { ...baseSession, user: { ...baseSession.user } },
      token: { sub: 'mongo-1', av: 3 },
    });
    expect(repoError['user']).toBeUndefined();
  });

  it('credentials authorize sets durable id and authVersion', async () => {
    authenticateCredentialsMock.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'mongo-cred-9',
        email: 'cred@example.com',
        role: 'user',
        passwordChangedAt: 50,
        authVersion: 7,
        displayName: 'Cred',
      },
    });

    const user = await credentialsProvider().authorize(
      {
        email: 'cred@example.com',
        password: 'Password1!',
        locale: 'en',
      },
      new Request('https://www.rinkuzu.app/api/auth/callback/credentials', {
        method: 'POST',
      }),
    );

    expect(user).toMatchObject({
      id: 'mongo-cred-9',
      email: 'cred@example.com',
      authVersion: 7,
      passwordChangedAt: 50,
    });
    // RIN-1263: the login form's locale is stored on an account with none yet.
    expect(rememberSignInLocaleMock).toHaveBeenCalledWith(signInRepository, 'mongo-cred-9', 'en');
  });

  it('credentials authorize rejects missing credentials before calling the service', async () => {
    await expect(
      credentialsProvider().authorize(
        undefined,
        new Request('https://www.rinkuzu.app/api/auth/callback/credentials', {
          method: 'POST',
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });

    expect(authenticateCredentialsMock).not.toHaveBeenCalled();
  });

  it('credentials authorize maps an authentication service failure', async () => {
    authenticateCredentialsMock.mockResolvedValueOnce({
      success: false,
      code: 'invalid_credentials',
    });

    await expect(
      credentialsProvider().authorize(
        {
          email: 'missing@example.com',
          password: 'Password1!',
        },
        new Request('https://www.rinkuzu.app/api/auth/callback/credentials', {
          method: 'POST',
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(rememberSignInLocaleMock).not.toHaveBeenCalled();
  });
});
