import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { env } from '@/lib/env';

describe('sendTransactionalMail', () => {
  beforeEach(() => {
    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: 're_123' }, error: null });
    __resetMailClient();
  });

  it('sends via Resend SDK with idempotency key', async () => {
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
        from: env.MAIL_FROM,
        to: ['a@b.com'],
        subject: 'hi',
        idempotencyKey: 'verify-email/abc',
      }),
    );
  });

  it('throws when Resend returns error in production', async () => {
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

  it('logs a successful Resend send', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await sendTransactionalMail({
      to: 'a@b.com',
      subject: 'hi',
      html: '<p>hi</p>',
      text: 'hi-preview',
    });

    expect(warn).toHaveBeenCalledWith(
      '[mail:resend] sent',
      expect.objectContaining({ id: 're_123', to: 'a@b.com', subject: 'hi' }),
    );
    expect(resendSendMock).toHaveBeenCalledTimes(1);
  });

  it('throws when Resend returns no id and no error', async () => {
    resendSendMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      sendTransactionalMail({
        to: 'a@b.com',
        subject: 'hi',
        html: '<p>hi</p>',
        text: 'hi',
      }),
    ).rejects.toThrow(/returned no id and no error/);
  });
});
