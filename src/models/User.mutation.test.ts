import { afterEach, describe, expect, it, vi } from 'vitest';
import User from '@/models/User';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';

type DocumentPreSaveMiddleware = {
  execPre: (
    name: string,
    context: InstanceType<typeof User>,
    args: unknown[],
    callback: (error: unknown) => void,
  ) => void;
};

function runPreSave(doc: InstanceType<typeof User>): Promise<void> {
  const model = doc.constructor as typeof User & {
    _middleware: DocumentPreSaveMiddleware;
  };
  const middleware = model._middleware;
  if (typeof middleware?.execPre !== 'function') {
    throw new Error('User model document pre-save middleware is unavailable');
  }

  return new Promise((resolve, reject) => {
    middleware.execPre('save', doc, [doc], (error: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve();
    });
  });
}

function expectDate(value: Date | null | undefined): Date {
  expect(value).toBeInstanceOf(Date);
  if (!(value instanceof Date)) {
    throw new Error('expected a Date instance');
  }
  return value;
}

describe('User model mutation coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('registers the User model name and document defaults', () => {
    expect(User.modelName).toBe('User');
    const user = new User({ email: 'Learner@Example.COM' });
    expect(user.email).toBe('learner@example.com');
    expect(user.role).toBe('user');
    expect(user.disable).toBe(0);
    expect(user.disabledAt).toBeNull();
    expect(user.disabledBy).toBeNull();
    expect(user.authVersion).toBe(0);
    expect(user.emailVerified).toBeNull();
    expect(user.emailVerificationTokenHash).toBeNull();
    expect(user.emailVerificationExpires).toBeNull();
    expect(user.passwordResetTokenHash).toBeNull();
    expect(user.passwordResetExpires).toBeNull();
    expect(user.passwordChangedAt).toBeNull();
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.failedLoginWindowStart).toBeNull();
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeNull();
    expect(user.lastLoginIp).toBeNull();
    expect(user.subscription?.isActive).toBe(false);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('requires a trimmed lowercase valid email', async () => {
    await expect(new User({}).validate()).rejects.toThrow(/Email is required|Path `email`/);

    const spaced = new User({ email: '  spaced@example.com  ' });
    await expect(spaced.validate()).resolves.toBeUndefined();
    expect(spaced.email).toBe('spaced@example.com');

    const invalidEmails = [
      'not-an-email',
      '@missing-local.com',
      'missing-domain@',
      'a@b',
      'has spaces@example.com',
      'double@@example.com',
    ];
    for (const email of invalidEmails) {
      await expect(new User({ email }).validate()).rejects.toThrow(/valid email|email/i);
    }

    await expect(new User({ email: 'ok@example.com' }).validate()).resolves.toBeUndefined();
    await expect(new User({ email: 'a@b.co' }).validate()).resolves.toBeUndefined();
  });

  it('enforces password minimum length using the shared auth constant', async () => {
    await expect(
      new User({ email: 'user@example.com', password: 'short' }).validate(),
    ).rejects.toThrow(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

    await expect(
      new User({
        email: 'user@example.com',
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
      }).validate(),
    ).rejects.toThrow(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

    await expect(
      new User({
        email: 'user@example.com',
        password: 'a'.repeat(PASSWORD_MIN_LENGTH),
      }).validate(),
    ).resolves.toBeUndefined();

    await expect(new User({ email: 'user@example.com' }).validate()).resolves.toBeUndefined();
  });

  it('enforces displayName and bio length limits and allows optional name/avatar', async () => {
    await expect(
      new User({
        email: 'user@example.com',
        displayName: 'x'.repeat(51),
      }).validate(),
    ).rejects.toThrow('Display name must be at most 50 characters');

    await expect(
      new User({
        email: 'user@example.com',
        displayName: 'x'.repeat(50),
      }).validate(),
    ).resolves.toBeUndefined();

    await expect(
      new User({
        email: 'user@example.com',
        bio: 'y'.repeat(161),
      }).validate(),
    ).rejects.toThrow('Bio must be at most 160 characters');

    await expect(
      new User({
        email: 'user@example.com',
        bio: 'y'.repeat(160),
        name: 'Full Name',
        avatar: 'https://cdn.example.com/a.png',
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it('restricts role to admin or user and defaults to user', async () => {
    const defaultRole = new User({ email: 'user@example.com' });
    expect(defaultRole.role).toBe('user');

    await expect(
      new User({ email: 'user@example.com', role: 'user' }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new User({ email: 'admin@example.com', role: 'admin' }).validate(),
    ).resolves.toBeUndefined();

    await expect(
      new User({ email: 'user@example.com', role: 'superadmin' as 'user' }).validate(),
    ).rejects.toThrow(/role|enum|admin|user/i);
  });

  it('accepts subscription and lockout telemetry fields', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');
    const user = new User({
      email: 'subscriber@example.com',
      role: 'user',
      failedLoginAttempts: 3,
      failedLoginWindowStart: start,
      lockedUntil: end,
      lastLoginAt: start,
      lastLoginIp: '203.0.113.10',
      subscription: {
        type: 'premium',
        startDate: start,
        endDate: end,
        isActive: true,
        payosOrderId: 'order-1',
        payosTransactionId: 'tx-1',
      },
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.subscription?.type).toBe('premium');
    expect(user.subscription?.isActive).toBe(true);
    expect(user.subscription?.payosOrderId).toBe('order-1');
    expect(user.subscription?.payosTransactionId).toBe('tx-1');
    expect(user.failedLoginAttempts).toBe(3);
    expect(user.lastLoginIp).toBe('203.0.113.10');
  });

  it('sets passwordChangedAt only when a password is modified', async () => {
    const withPassword = new User({
      email: 'user@example.com',
      password: 'password1',
    });
    expect(withPassword.passwordChangedAt).toBeNull();
    expect(withPassword.isModified('password')).toBe(true);

    await runPreSave(withPassword);
    const firstChangedAt = expectDate(withPassword.passwordChangedAt);
    const firstChangedAtMs = firstChangedAt.getTime();

    const withoutPassword = new User({ email: 'plain@example.com' });
    expect(withoutPassword.isModified('password')).toBe(false);
    await runPreSave(withoutPassword);
    expect(withoutPassword.passwordChangedAt).toBeNull();

    const emptyPassword = new User({ email: 'empty@example.com' });
    emptyPassword.set('password', undefined);
    emptyPassword.unmarkModified('password');
    await runPreSave(emptyPassword);
    expect(emptyPassword.passwordChangedAt).toBeNull();

    // Re-saving without modifying password must not force a new timestamp path when
    // isModified('password') is false.
    withPassword.unmarkModified('password');
    const before = expectDate(withPassword.passwordChangedAt).getTime();
    await runPreSave(withPassword);
    expect(expectDate(withPassword.passwordChangedAt).getTime()).toBe(before);
    expect(firstChangedAtMs).toBe(before);
  });

  it('declares the expected compound and partial indexes', () => {
    const indexes = User.schema.indexes();

    expect(
      indexes.some(
        ([spec]) =>
          spec['role'] === 1 && spec['createdAt'] === -1 && Object.keys(spec).length === 2,
      ),
    ).toBe(true);
    expect(
      indexes.some(
        ([spec]) => spec['role'] === 1 && spec['disable'] === 1 && Object.keys(spec).length === 2,
      ),
    ).toBe(true);
    expect(
      indexes.some(([spec]) => spec['createdAt'] === -1 && Object.keys(spec).length === 1),
    ).toBe(true);
    expect(
      indexes.some(
        ([spec, options]) =>
          spec['passwordResetTokenHash'] === 1 &&
          Boolean(
            options &&
            typeof options === 'object' &&
            'partialFilterExpression' in options &&
            (options as { partialFilterExpression?: unknown }).partialFilterExpression,
          ),
      ),
    ).toBe(true);
    expect(
      indexes.some(
        ([spec, options]) =>
          spec['emailVerificationTokenHash'] === 1 &&
          Boolean(
            options &&
            typeof options === 'object' &&
            'partialFilterExpression' in options &&
            (options as { partialFilterExpression?: unknown }).partialFilterExpression,
          ),
      ),
    ).toBe(true);
    expect(
      indexes.some(
        ([spec, options]) =>
          spec['lockedUntil'] === 1 &&
          Boolean(options && typeof options === 'object' && 'sparse' in options && options.sparse),
      ),
    ).toBe(true);
    expect(
      indexes.some(
        ([spec]) =>
          spec['subscription.isActive'] === 1 &&
          spec['subscription.endDate'] === 1 &&
          Object.keys(spec).length === 2,
      ),
    ).toBe(true);
  });
});
