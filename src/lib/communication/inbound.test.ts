import { describe, expect, it } from 'vitest';
import {
  extractFeedbackReplyToken,
  normalizeInboundFeedbackBody,
  parseInboundSenderAddress,
} from './inbound';

describe('feedback email receiving policy', () => {
  it('extracts only a token addressed to the configured reply domain', () => {
    expect(
      extractFeedbackReplyToken(
        ['other@example.com', 'feedback+abc_123@reply.rinkuzu.app'],
        'reply.rinkuzu.app',
      ),
    ).toBe('abc_123');
    expect(extractFeedbackReplyToken(['feedback+abc@evil.test'], 'reply.rinkuzu.app')).toBeNull();
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
