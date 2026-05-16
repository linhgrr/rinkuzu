import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resendSendMock, ResendCtor } = vi.hoisted(() => {
  const resendSendMock = vi.fn();
  function ResendCtor() {
    return { emails: { send: resendSendMock } };
  }
  return { resendSendMock, ResendCtor };
});

vi.mock('resend', () => ({
  Resend: ResendCtor,
}));

import { __resetMailClient, sendTransactionalMail } from '@/lib/mail';

describe('sendTransactionalMail', () => {
  beforeEach(() => {
    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: 're_123' }, error: null });
    __resetMailClient();
    delete process.env['RESEND_API_KEY'];
    process.env['MAIL_FROM'] = 'noreply@example.com';
  });

  afterEach(() => {
    delete process.env['RESEND_API_KEY'];
    delete process.env['MAIL_FROM'];
    vi.unstubAllEnvs();
  });

  it('sends via Resend SDK with idempotency key', async () => {
    process.env['RESEND_API_KEY'] = 'rk_test';

    await sendTransactionalMail({
      to: 'a@b.com',
      subject: 'hi',
      html: '<p>hi</p>',
      text: 'hi',
      idempotencyKey: 'verify-email/abc',
    });

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: ['a@b.com'],
        subject: 'hi',
        idempotencyKey: 'verify-email/abc',
      }),
    );
  });

  it('throws when Resend returns error in production', async () => {
    process.env['RESEND_API_KEY'] = 'rk_test';
    vi.stubEnv('NODE_ENV', 'production');
    resendSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'Invalid `from`' },
    });

    await expect(
      sendTransactionalMail({
        to: 'a@b.com',
        subject: 'hi',
        html: '<p>hi</p>',
        text: 'hi',
      }),
    ).rejects.toThrow(/validation_error.*Invalid `from`/);
  });

  it('logs to console in dev when no API key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await sendTransactionalMail({
      to: 'a@b.com',
      subject: 'hi',
      html: '<p>hi</p>',
      text: 'hi-preview',
    });

    expect(warn).toHaveBeenCalledWith(
      '[mail:dev] queued',
      expect.objectContaining({ to: 'a@b.com', subject: 'hi' }),
    );
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('throws in production when API key missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(
      sendTransactionalMail({
        to: 'a@b.com',
        subject: 'hi',
        html: '<p>hi</p>',
        text: 'hi',
      }),
    ).rejects.toThrow(/Mailer is not configured/);
  });
});
