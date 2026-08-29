import { createHmac } from 'node:crypto';

/**
 * Reply-To addressing for feedback outreach.
 *
 * Two independent tokens are derived per conversation:
 * - the preference token, which is embedded in decline/opt-out links and stays
 *   long-lived so already-delivered emails keep working;
 * - the reply-address token, which is opaque and compact enough that the whole
 *   `feedback+<token>` local part fits RFC 5321's 64 octet limit.
 *
 * Both are deterministic HMACs so a queued email can be repaired in place
 * without invalidating anything that was already sent.
 */

/** RFC 5321 caps an email local part at 64 octets. */
const EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const FEEDBACK_REPLY_LOCAL_PREFIX = 'feedback+';

/** base64url of a SHA-256 HMAC: 43 characters, 256 bits of entropy. */
const REPLY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

function signedToken(namespace: string, conversationId: string, secret: string): string {
  if (!conversationId.trim()) throw new Error('Feedback conversation id is required');
  if (!secret.trim()) throw new Error('Feedback token secret is required');
  return createHmac('sha256', secret).update(`${namespace}:${conversationId}`).digest('base64url');
}

/** Token used by decline/opt-out links. It stays separate from the email address token. */
export function feedbackPreferenceToken(conversationId: string, secret: string): string {
  return `${conversationId}_${signedToken('feedback', conversationId, secret)}`;
}

/** Compact opaque token that keeps the complete Reply-To local part below 64 octets. */
export function feedbackReplyToken(conversationId: string, secret: string): string {
  return signedToken('feedback-reply', conversationId, secret);
}

/** Shape check for a value taken from an inbound address before it is hashed and looked up. */
export function isFeedbackReplyToken(value: string): boolean {
  return REPLY_TOKEN_PATTERN.test(value);
}

export function feedbackReplyAddress(token: string, domain: string): string {
  if (!isFeedbackReplyToken(token)) {
    throw new Error('Feedback Reply-To token is invalid');
  }
  const localPart = `${FEEDBACK_REPLY_LOCAL_PREFIX}${token}`;
  const normalizedDomain = domain.trim().toLowerCase();
  if (localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH || !DOMAIN_PATTERN.test(normalizedDomain)) {
    throw new Error('Feedback Reply-To address is invalid');
  }
  return `${localPart}@${normalizedDomain}`;
}
