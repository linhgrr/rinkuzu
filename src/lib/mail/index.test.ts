import { describe, expect, it } from 'vitest';

import {
  buildPasswordChangedMessage,
  buildPasswordResetMessage,
  buildVerifyEmailMessage,
} from '@/lib/mail';

describe('mail templates', () => {
  it('VerifyEmail renders subject + tokenized URL', async () => {
    const msg = await buildVerifyEmailMessage('user@example.com', 'tok-123');
    expect(msg.to).toBe('user@example.com');
    expect(msg.subject).toMatch(/verify/i);
    expect(msg.html).toContain('/verify-email?token=tok-123');
    expect(msg.text).toContain('/verify-email?token=tok-123');
    // text rendering should strip tags
    expect(msg.text).not.toContain('<a ');
  });

  it('VerifyEmail carries a safe callbackUrl and drops an unsafe one', async () => {
    const safe = await buildVerifyEmailMessage('user@example.com', 'tok-123', {
      callbackUrl: '/quiz/nhap-mon-ai',
    });
    expect(safe.text).toContain('/verify-email?token=tok-123&callbackUrl=%2Fquiz%2Fnhap-mon-ai');
    // The idempotency key stays token-based so a retry never sends a second mail.
    expect(safe.idempotencyKey).toBe('verify-email/tok-123');

    const unsafe = await buildVerifyEmailMessage('user@example.com', 'tok-123', {
      callbackUrl: '//evil.com',
    });
    expect(unsafe.text).toContain('/verify-email?token=tok-123');
    expect(unsafe.text).not.toContain('callbackUrl');
    expect(unsafe.text).not.toContain('evil.com');
  });

  it('ResetPassword renders subject + tokenized URL', async () => {
    const msg = await buildPasswordResetMessage('user@example.com', 'tok-456');
    expect(msg.subject).toMatch(/reset/i);
    expect(msg.html).toContain('/reset-password?token=tok-456');
    expect(msg.text).toContain('/reset-password?token=tok-456');
  });

  it('PasswordChanged renders forgot-password fallback link', async () => {
    const msg = await buildPasswordChangedMessage('user@example.com');
    expect(msg.subject).toMatch(/password/i);
    expect(msg.html).toContain('/forgot-password');
    expect(msg.text.length).toBeGreaterThan(0);
  });
});
