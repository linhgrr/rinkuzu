import { describe, expect, it } from 'vitest';
import {
  feedbackPreferenceToken,
  feedbackReplyAddress,
  feedbackReplyToken,
  isFeedbackReplyToken,
} from './feedback-address';

/**
 * RFC 5321 section 4.5.3.1.1. Restated here on purpose: a test that reads the
 * limit out of the module under test cannot fail when that module changes it.
 */
const RFC5321_LOCAL_PART_MAX_LENGTH = 64;

const conversationId = '6a8ed209f04328ac17443d91';
const secret = 'a-production-length-auth-secret';

describe('feedback Reply-To addressing', () => {
  it('uses a compact opaque token that fits the email local-part limit', () => {
    const token = feedbackReplyToken(conversationId, secret);
    const address = feedbackReplyAddress(token, 'feedback.rinkuzu.app');
    const localPart = address.split('@')[0] ?? '';

    expect(localPart).toHaveLength(52);
    expect(localPart.length).toBeLessThanOrEqual(RFC5321_LOCAL_PART_MAX_LENGTH);
    expect(address).toMatch(/^feedback\+[A-Za-z0-9_-]{43}@feedback\.rinkuzu\.app$/u);
  });

  it('stays inside the limit for the longest conversation id Mongo can produce', () => {
    const token = feedbackReplyToken('f'.repeat(24), secret);
    const localPart = feedbackReplyAddress(token, 'feedback.rinkuzu.app').split('@')[0] ?? '';

    expect(localPart.length).toBeLessThanOrEqual(RFC5321_LOCAL_PART_MAX_LENGTH);
  });

  it('carries full HMAC entropy in email-safe characters only', () => {
    const token = feedbackReplyToken(conversationId, secret);

    // 43 base64url characters encode the complete 256 bit SHA-256 HMAC.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('derives a different token per conversation and per secret', () => {
    expect(feedbackReplyToken(conversationId, secret)).not.toBe(
      feedbackReplyToken('6a8ed209f04328ac17443d92', secret),
    );
    expect(feedbackReplyToken(conversationId, secret)).not.toBe(
      feedbackReplyToken(conversationId, 'another-production-length-secret'),
    );
  });

  it('is deterministic so a queued email can be repaired in place', () => {
    expect(feedbackReplyToken(conversationId, secret)).toBe(
      feedbackReplyToken(conversationId, secret),
    );
  });

  it('keeps preference tokens independent from Reply-To tokens', () => {
    const preference = feedbackPreferenceToken(conversationId, secret);
    const reply = feedbackReplyToken(conversationId, secret);

    expect(preference).not.toBe(reply);
    expect(preference.startsWith(`${conversationId}_`)).toBe(true);
    expect(preference).not.toContain(reply);
    // The legacy preference token is exactly what made the address too long.
    expect(`feedback+${preference}`.length).toBeGreaterThan(RFC5321_LOCAL_PART_MAX_LENGTH);
  });

  it('rejects a token that is not a reply-address token', () => {
    expect(isFeedbackReplyToken(feedbackPreferenceToken(conversationId, secret))).toBe(false);
    expect(isFeedbackReplyToken('short')).toBe(false);
    expect(isFeedbackReplyToken(`${'a'.repeat(42)}+`)).toBe(false);
    expect(isFeedbackReplyToken(feedbackReplyToken(conversationId, secret))).toBe(true);
  });

  it('rejects an oversized token, an unsafe token or an invalid domain', () => {
    expect(() => feedbackReplyAddress('x'.repeat(60), 'feedback.rinkuzu.app')).toThrow(
      'token is invalid',
    );
    expect(() => feedbackReplyAddress(`${'x'.repeat(42)}@`, 'feedback.rinkuzu.app')).toThrow(
      'token is invalid',
    );
    expect(() =>
      feedbackReplyAddress(feedbackReplyToken(conversationId, secret), 'not a domain'),
    ).toThrow('address is invalid');
    expect(() =>
      feedbackReplyAddress(feedbackReplyToken(conversationId, secret), 'localhost'),
    ).toThrow('address is invalid');
  });

  it('normalizes the domain and refuses to derive a token without inputs', () => {
    expect(
      feedbackReplyAddress(feedbackReplyToken(conversationId, secret), ' Feedback.RinKuzu.App '),
    ).toMatch(/@feedback\.rinkuzu\.app$/u);
    expect(() => feedbackReplyToken('', secret)).toThrow('conversation id is required');
    expect(() => feedbackReplyToken(conversationId, '')).toThrow('secret is required');
  });
});
