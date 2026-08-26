import { describe, expect, it } from 'vitest';
import {
  extractFeedbackReplyToken,
  normalizeInboundFeedbackBody,
  parseInboundSenderAddress,
} from './inbound';

const TOKEN = 'k1QwErTy_uIoPaSdFgHjKlZxCvBnM-1234567890abc';

describe('feedback email receiving policy', () => {
  it('extracts only a token addressed to the configured reply domain', () => {
    expect(
      extractFeedbackReplyToken(
        ['other@example.com', `feedback+${TOKEN}@reply.rinkuzu.app`],
        'reply.rinkuzu.app',
      ),
    ).toBe(TOKEN);
    expect(
      extractFeedbackReplyToken([`feedback+${TOKEN}@evil.test`], 'reply.rinkuzu.app'),
    ).toBeNull();
  });

  it('rejects a destination whose token does not have the reply-token shape', () => {
    expect(
      extractFeedbackReplyToken(['feedback+abc_123@reply.rinkuzu.app'], 'reply.rinkuzu.app'),
    ).toBeNull();
    expect(
      extractFeedbackReplyToken(
        [`feedback+${'6a8ed209f04328ac17443d91'}_${TOKEN}@reply.rinkuzu.app`],
        'reply.rinkuzu.app',
      ),
    ).toBeNull();
  });

  it('canonicalizes named senders without provider-specific rewriting', () => {
    expect(parseInboundSenderAddress('User Name <USER+tag@Example.COM>')).toBe(
      'user+tag@example.com',
    );
  });

  it('strips quoted history and signatures from plain text replies', () => {
    const body = `Mình thấy phần ôn tập rất hữu ích.\n\nTrân trọng,\nUser\n\nOn Aug 25, 2026, RinKuzu wrote:\n> Bạn thấy trải nghiệm thế nào?`;
    expect(normalizeInboundFeedbackBody(body, null)).toContain('Mình thấy phần ôn tập');
    expect(normalizeInboundFeedbackBody(body, null)).not.toContain('Bạn thấy trải nghiệm');
  });

  it('converts HTML-only replies and caps stored text', () => {
    expect(normalizeInboundFeedbackBody(null, '<p>Trải nghiệm rất tốt.</p>')).toBe(
      'Trải nghiệm rất tốt.',
    );
    expect(normalizeInboundFeedbackBody('x'.repeat(25_000), null)).toHaveLength(20_000);
  });

  it('rejects empty inbound messages', () => {
    expect(() => normalizeInboundFeedbackBody('   ', null)).toThrow('empty');
  });
});
