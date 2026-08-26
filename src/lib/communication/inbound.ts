import EmailReplyParser from 'email-reply-parser';
import { convert } from 'html-to-text';
import { canonicalizeEmail } from '@/shared/email/canonical-email';

export function parseInboundSenderAddress(value: string): string {
  const bracket = value.match(/<([^<>]+)>/u)?.[1];
  return canonicalizeEmail(bracket ?? value);
}

export function extractFeedbackReplyToken(
  addresses: readonly string[],
  replyDomain: string,
): string | null {
  const destination = addresses.find((address) =>
    address.toLowerCase().endsWith(`@${replyDomain.toLowerCase()}`),
  );
  return destination?.match(/^feedback\+([^@]+)@/iu)?.[1] ?? null;
}

export function normalizeInboundFeedbackBody(text: string | null, html: string | null): string {
  const raw = text?.trim() || (html ? convert(html, { wordwrap: 100 }) : '');
  if (!raw.trim()) throw new Error('Inbound email is empty');
  const visible = new EmailReplyParser().parseReply(raw).trim();
  if (!visible) throw new Error('Inbound reply contains no new text');
  return visible.slice(0, 20_000);
}
