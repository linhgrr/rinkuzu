import { describe, expect, it } from 'vitest';

import {
  changePasswordSchema,
  emailSchema,
  flattenZodError,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validation/auth';

describe('emailSchema', () => {
  it('lowercases and trims emails', () => {
    expect(emailSchema.parse('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('foo').success).toBe(false);
    expect(emailSchema.safeParse('foo@bar').success).toBe(false);
    expect(emailSchema.safeParse(`${'a'.repeat(EMAIL_MAX_LENGTH)}@b.co`).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('enforces min/max length', () => {
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('passes valid credentials and lowercases email', () => {
    const parsed = loginSchema.parse({ email: 'A@B.com', password: 'irrelevant' });
    expect(parsed.email).toBe('a@b.com');
    expect(parsed.password).toBe('irrelevant');
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('requires 8-char password', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'longenough' }).success).toBe(
      true,
    );
  });

  it('accepts optional displayName and trims it', () => {
    const parsed = registerSchema.parse({
      email: 'a@b.com',
      password: 'longenough',
      displayName: '  Pat  ',
    });
    expect(parsed.displayName).toBe('Pat');
  });
});

describe('forgotPasswordSchema / resendVerificationSchema', () => {
  it('only accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
    expect(resendVerificationSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema / verifyEmailSchema', () => {
  it('enforces token length bounds', () => {
    const validToken = 'a'.repeat(40);
    expect(verifyEmailSchema.safeParse({ token: validToken }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token: 'too-short' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ token: 'a'.repeat(200) }).success).toBe(false);

    expect(
      resetPasswordSchema.safeParse({ token: validToken, password: 'longenough' }).success,
    ).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: validToken, password: 'short' }).success).toBe(
      false,
    );
  });
});

describe('changePasswordSchema', () => {
  it('requires the new password to differ from current', () => {
    const same = changePasswordSchema.safeParse({
      currentPassword: 'longenough',
      newPassword: 'longenough',
    });
    expect(same.success).toBe(false);

    const ok = changePasswordSchema.safeParse({
      currentPassword: 'oldpass12',
      newPassword: 'newpass12',
    });
    expect(ok.success).toBe(true);
  });
});

describe('flattenZodError', () => {
  it('returns the first issue as detail and per-field map', () => {
    const result = registerSchema.safeParse({ email: 'no', password: '1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodError(result.error);
      expect(flat.detail).toBeTypeOf('string');
      expect(flat.detail.length).toBeGreaterThan(0);
      expect(Object.keys(flat.fields).sort()).toEqual(['email', 'password']);
    }
  });
});
