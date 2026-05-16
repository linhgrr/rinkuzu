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
