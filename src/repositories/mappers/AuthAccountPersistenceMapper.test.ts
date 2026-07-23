import { describe, expect, it } from 'vitest';
import { AuthAccountPersistenceMapper } from '@/repositories/mappers/AuthAccountPersistenceMapper';

describe('AuthAccountPersistenceMapper', () => {
  it('omits absent and null security state while preserving identity', () => {
    expect(
      AuthAccountPersistenceMapper.toSecurityState({
        _id: 'account-1',
        email: 'learner@example.com',
        role: 'user',
        emailVerified: null,
        passwordResetExpires: null,
      }),
    ).toEqual({
      id: 'account-1',
      email: 'learner@example.com',
      role: 'user',
      authProviders: [],
    });
  });

  it('maps every present security field without changing its value', () => {
    const emailVerified = new Date('2026-07-01T00:00:00.000Z');
    const emailVerificationExpires = new Date('2026-07-02T00:00:00.000Z');
    const passwordResetExpires = new Date('2026-07-03T00:00:00.000Z');
    expect(
      AuthAccountPersistenceMapper.toSecurityState({
        _id: 'account-1',
        email: 'learner@example.com',
        role: 'user',
        password: 'hash',
        emailVerified,
        emailVerificationTokenHash: 'verify-hash',
        emailVerificationExpires,
        passwordResetTokenHash: 'reset-hash',
        passwordResetExpires,
      }),
    ).toEqual({
      id: 'account-1',
      email: 'learner@example.com',
      role: 'user',
      authProviders: [],
      passwordHash: 'hash',
      emailVerified,
      emailVerificationTokenHash: 'verify-hash',
      emailVerificationExpires,
      passwordResetTokenHash: 'reset-hash',
      passwordResetExpires,
    });
  });

  it('requires exact non-negative integer authVersion for login and session maps', () => {
    expect(() =>
      AuthAccountPersistenceMapper.toLoginAccount({
        _id: 'account-1',
        email: 'learner@example.com',
        role: 'user',
      }),
    ).toThrow(/authVersion/);

    expect(
      AuthAccountPersistenceMapper.toAuthenticatedUser({
        _id: 'account-1',
        email: 'learner@example.com',
        role: 'user',
        authVersion: 4,
      }),
    ).toMatchObject({ authVersion: 4, passwordChangedAt: null });
  });
});
