import { createHmac } from 'node:crypto';

/**
 * Build-time mirror of `src/lib/communication/feedback-address.ts`.
 *
 * The infrastructure validator runs as a plain Node script and cannot import
 * the TypeScript module, so the derivation lives here as well. The two copies
 * are pinned together by `tests/communication/feedback-address-parity.test.ts`,
 * which fails whenever they drift.
 */

export const EMAIL_LOCAL_PART_MAX_LENGTH = 64;
export const FEEDBACK_REPLY_LOCAL_PREFIX = 'feedback+';

const REPLY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

/**
 * @param {string} namespace
 * @param {string} conversationId
 * @param {string} secret
 * @returns {string}
 */
function signedToken(namespace, conversationId, secret) {
  if (!conversationId.trim()) throw new Error('Feedback conversation id is required');
  if (!secret.trim()) throw new Error('Feedback token secret is required');
  return createHmac('sha256', secret).update(`${namespace}:${conversationId}`).digest('base64url');
}

/**
 * @param {string} conversationId
 * @param {string} secret
 * @returns {string}
 */
export function feedbackPreferenceToken(conversationId, secret) {
  return `${conversationId}_${signedToken('feedback', conversationId, secret)}`;
}

/**
 * @param {string} conversationId
 * @param {string} secret
 * @returns {string}
 */
export function feedbackReplyToken(conversationId, secret) {
  return signedToken('feedback-reply', conversationId, secret);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isFeedbackReplyToken(value) {
  return REPLY_TOKEN_PATTERN.test(value);
}

/**
 * @param {string} token
 * @param {string} domain
 * @returns {string}
 */
export function feedbackReplyAddress(token, domain) {
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
