/**
 * Dependency contract for Auth.js v5 OAuth profile → user/account mapping.
 *
 * Isolation: import the installed `@auth/core` callback module via absolute
 * filesystem path under `node_modules`. Package `exports` do not re-export
 * `getUserAndAccount`; production app code never deep-imports this path.
 * This test alone pins the contract that:
 * - core overwrites `user.id` with `crypto.randomUUID()`
 * - custom profile fields (e.g. `dbUserId`) survive the spread
 * - `account.providerAccountId` is the profile `id` (Google `sub`)
 *
 * Why it matters: Rinkuzu must never treat Auth core's generated `user.id`
 * as the Mongo account id. Google sign-in stores the DB id on `dbUserId`
 * and uses `selectAuthDbUserId` for JWT/session claims.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { selectAuthDbUserId } from '@/lib/auth/auth-db-identity';

const AUTH_CORE_CALLBACK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../node_modules/@auth/core/lib/actions/callback/oauth/callback.js',
);

type GetUserAndAccount = (
  profile: unknown,
  provider: {
    id: string;
    type: string;
    profile: (profile: unknown, tokens: unknown) => Promise<Record<string, unknown>>;
  },
  tokens: Record<string, unknown>,
  logger: { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
) => Promise<{ user: Record<string, unknown>; account: Record<string, unknown> } | undefined>;

describe('Auth.js Google identity dependency contract', () => {
  it('overwrites user.id, preserves dbUserId, and sets providerAccountId from Google sub', async () => {
    const { getUserAndAccount } = (await import(pathToFileURL(AUTH_CORE_CALLBACK).href)) as {
      getUserAndAccount: GetUserAndAccount;
    };

    const googleSub = 'google-sub-canonical-001';
    const mongoUserId = '507f191e810c19729de860ea';
    const authenticateGoogle = vi.fn(
      async (_input?: { subject: string; email: unknown; emailVerified: boolean }) => ({
        success: true as const,
        user: {
          id: mongoUserId,
          email: 'learner@example.com',
          role: 'user' as const,
          passwordChangedAt: null,
          authVersion: 0,
        },
      }),
    );

    // Mirrors production Google provider.profile: one repository upsert, then
    // return id=sub (providerAccountId) + dbUserId (Mongo) + claims.
    const provider = {
      id: 'google',
      type: 'oidc',
      profile: async (oauthProfile: unknown) => {
        const record = oauthProfile as Record<string, unknown>;
        const sub = typeof record['sub'] === 'string' ? record['sub'] : '';
        if (!sub) throw new Error('missing Google sub');

        const result = await authenticateGoogle({
          subject: sub,
          email: record['email'],
          emailVerified: true,
        });
        if (!result.success) throw new Error('Google authentication rejected');

        return {
          id: sub,
          dbUserId: result.user.id,
          email: result.user.email,
          role: result.user.role,
          passwordChangedAt: result.user.passwordChangedAt,
          authVersion: result.user.authVersion,
        };
      },
    };

    const logger = { debug: vi.fn(), error: vi.fn() };
    const mapped = await getUserAndAccount(
      {
        sub: googleSub,
        email: 'learner@example.com',
        email_verified: true,
      },
      provider,
      { access_token: 'token' },
      logger,
    );

    expect(mapped).toBeDefined();
    if (!mapped) throw new Error('expected getUserAndAccount result');

    // Core overwrites id; custom dbUserId survives.
    expect(mapped.user['id']).not.toBe(mongoUserId);
    expect(mapped.user['id']).not.toBe(googleSub);
    expect(typeof mapped.user['id']).toBe('string');
    expect(String(mapped.user['id']).length).toBeGreaterThan(10);
    expect(mapped.user['dbUserId']).toBe(mongoUserId);
    expect(mapped.user['authVersion']).toBe(0);

    // providerAccountId is the profile id we returned (Google sub).
    expect(mapped.account['providerAccountId']).toBe(googleSub);
    expect(mapped.account['provider']).toBe('google');

    // Local selector chooses durable DB id for JWT claims, never core UUID.
    expect(selectAuthDbUserId('google', mapped.user)).toBe(mongoUserId);
    expect(selectAuthDbUserId('google', mapped.user)).not.toBe(mapped.user['id']);

    // Exactly one repository Google operation from profile().
    expect(authenticateGoogle).toHaveBeenCalledTimes(1);
  });
});
