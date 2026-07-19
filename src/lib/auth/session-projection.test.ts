import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import { applySessionUser, projectTokenToSession } from '@/lib/auth/session-projection';

function baseSession(): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 'placeholder',
      email: 'placeholder@example.com',
      role: 'user',
    },
  };
}

describe('projectTokenToSession', () => {
  it('projects valid JWT claims onto the session', () => {
    const token = {
      sub: 'user-1',
      role: 'admin',
      avatar: 'https://cdn.example/a.png',
      displayName: 'Ada',
    } as JWT;

    const session = projectTokenToSession(baseSession(), token);
    expect(session.user).toMatchObject({
      id: 'user-1',
      role: 'admin',
      avatar: 'https://cdn.example/a.png',
      displayName: 'Ada',
    });
  });

  it('strips user when role is missing', () => {
    const token = { sub: 'user-1' } as JWT;
    const session = projectTokenToSession(baseSession(), token);
    expect(session.user).toBeUndefined();
  });
});

describe('applySessionUser', () => {
  const token = {
    sub: 'user-1',
    role: 'user',
    pwc: 1_700_000_000_000,
    av: 3,
  } as JWT;

  it('hydrates session from DB user when av matches', () => {
    const session = applySessionUser(baseSession(), token, {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      displayName: 'Rin',
      passwordChangedAt: 1_700_000_000_000,
      authVersion: 3,
    });

    expect(session.user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Rin',
    });
  });

  it('revokes session when passwordChangedAt is newer than token.pwc', () => {
    const session = applySessionUser(baseSession(), token, {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      passwordChangedAt: 1_800_000_000_000,
      authVersion: 3,
    });
    expect(session.user).toBeUndefined();
  });

  it('revokes session when user is missing (disabled or deleted)', () => {
    const session = applySessionUser(baseSession(), token, null);
    expect(session.user).toBeUndefined();
  });

  it('fails closed when JWT av is missing', () => {
    const session = applySessionUser(
      baseSession(),
      { sub: 'user-1', role: 'user', pwc: 1_700_000_000_000 } as JWT,
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        passwordChangedAt: null,
        authVersion: 0,
      },
    );
    expect(session.user).toBeUndefined();
  });

  it('revokes immediately when authVersion mismatches (disable/restore)', () => {
    const session = applySessionUser(baseSession(), token, {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      passwordChangedAt: 1_700_000_000_000,
      authVersion: 4,
    });
    expect(session.user).toBeUndefined();
  });

  it('does not revive an old JWT after restore increments authVersion again', () => {
    // Token still has pre-disable av=3; restore brought DB to av=5.
    const session = applySessionUser(baseSession(), { ...token, av: 3 } as JWT, {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      passwordChangedAt: null,
      authVersion: 5,
    });
    expect(session.user).toBeUndefined();
  });
});
