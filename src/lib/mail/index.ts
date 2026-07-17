import 'server-only';

import { render } from '@react-email/render';
import { Resend } from 'resend';

import { PasswordChanged } from './templates/PasswordChanged';
import { ResetPassword } from './templates/ResetPassword';
import { VerifyEmail } from './templates/VerifyEmail';
import { env } from '@/lib/env';
import { publicEnv } from '@/lib/public-env';
import { logger } from '@/lib/logger';

type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Idempotency key, propagated to Resend to dedupe retries within 24h. */
  idempotencyKey?: string;
};

type RenderedMail = {
  html: string;
  text: string;
};

interface MailIdempotencyOptions {
  idempotencyKey?: string;
}

let cachedResend: Resend | null = null;

function getResendClient(): Resend {
  if (cachedResend) return cachedResend;
  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

export async function sendTransactionalMail(msg: MailMessage): Promise<void> {
  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: env.MAIL_FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : {}),
    });

    if (error) {
      throw new Error(`Resend send failed: [${error.name}] ${error.message}`);
    }
    if (!data?.id) {
      throw new Error('Resend send returned no id and no error');
    }

    console.warn('[mail:resend] sent', { id: data.id, to: msg.to, subject: msg.subject });
  } catch (error) {
    logger.error({ error }, '[mail] send failed');
    throw error;
  }
}

function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
}

async function renderMail(element: React.ReactElement): Promise<RenderedMail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

function truncateIdempotency(key: string): string {
  return key.length > 256 ? key.slice(0, 256) : key;
}

export async function buildVerifyEmailMessage(
  to: string,
  rawToken: string,
  options: MailIdempotencyOptions = {},
): Promise<MailMessage> {
  const url = `${siteUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const { html, text } = await renderMail(VerifyEmail({ url }));
  return {
    to,
    subject: 'Verify your RinKuzu email',
    html,
    text,
    idempotencyKey: options.idempotencyKey
      ? truncateIdempotency(options.idempotencyKey)
      : `verify-email/${rawToken.slice(0, 32)}`,
  };
}

export async function buildPasswordResetMessage(
  to: string,
  rawToken: string,
  options: MailIdempotencyOptions = {},
): Promise<MailMessage> {
  const url = `${siteUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { html, text } = await renderMail(ResetPassword({ url }));
  return {
    to,
    subject: 'Reset your RinKuzu password',
    html,
    text,
    idempotencyKey: options.idempotencyKey
      ? truncateIdempotency(options.idempotencyKey)
      : `password-reset/${rawToken.slice(0, 32)}`,
  };
}

export async function buildPasswordChangedMessage(
  to: string,
  options: MailIdempotencyOptions = {},
): Promise<MailMessage> {
  const resetUrl = `${siteUrl()}/forgot-password`;
  const { html, text } = await renderMail(PasswordChanged({ resetUrl }));
  return {
    to,
    subject: 'Your RinKuzu password was changed',
    html,
    text,
    ...(options.idempotencyKey
      ? { idempotencyKey: truncateIdempotency(options.idempotencyKey) }
      : {}),
  };
}
