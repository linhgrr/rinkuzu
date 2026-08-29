import { describe, expect, it } from 'vitest';

import {
  feedbackPreferenceToken,
  feedbackReplyAddress,
  feedbackReplyToken,
  isFeedbackReplyToken,
} from '@/lib/communication/feedback-address';
import * as shared from '../../scripts/feedback-address.shared.mjs';

/**
 * `scripts/validate-communication-infrastructure.mjs` runs as plain Node during
 * `vercel-build` and cannot import the TypeScript helper, so it uses a mirrored
 * copy. This suite is what keeps the two honest: if either side changes the
 * derivation, the build validation would stop describing the addresses the
 * runtime actually sends, and this fails first.
 */
describe('build-time Reply-To mirror matches the runtime helper', () => {
  const secret = 'a-production-length-auth-secret';
  const conversationIds = ['6a8ed209f04328ac17443d91', 'f'.repeat(24), '0'.repeat(24)];

  it('holds the runtime helper to the limits the mirror publishes', () => {
    // Comparing the two literals only proved they were spelled the same. What
    // the build validator actually relies on is that an address the runtime
    // emits fits inside the limit the mirror advertises and carries the prefix
    // the mirror looks for.
    const address = feedbackReplyAddress(
      feedbackReplyToken(conversationIds[0] as string, secret),
      'feedback.rinkuzu.app',
    );
    const localPart = address.split('@')[0] ?? '';

    expect(localPart.length).toBeLessThanOrEqual(shared.EMAIL_LOCAL_PART_MAX_LENGTH);
    expect(localPart.startsWith(shared.FEEDBACK_REPLY_LOCAL_PREFIX)).toBe(true);
  });

  it.each(conversationIds)('derives identical tokens and addresses for %s', (conversationId) => {
    expect(shared.feedbackReplyToken(conversationId, secret)).toBe(
      feedbackReplyToken(conversationId, secret),
    );
    expect(shared.feedbackPreferenceToken(conversationId, secret)).toBe(
      feedbackPreferenceToken(conversationId, secret),
    );
    expect(
      shared.feedbackReplyAddress(
        shared.feedbackReplyToken(conversationId, secret),
        'feedback.rinkuzu.app',
      ),
    ).toBe(
      feedbackReplyAddress(feedbackReplyToken(conversationId, secret), 'feedback.rinkuzu.app'),
    );
  });

  it('agrees on which tokens are acceptable', () => {
    const cases = [
      feedbackReplyToken(conversationIds[0] as string, secret),
      feedbackPreferenceToken(conversationIds[0] as string, secret),
      'short',
      `${'a'.repeat(42)}+`,
    ];
    for (const value of cases) {
      expect(shared.isFeedbackReplyToken(value)).toBe(isFeedbackReplyToken(value));
    }
  });

  it('rejects the same invalid domains', () => {
    const token = feedbackReplyToken(conversationIds[0] as string, secret);
    for (const domain of ['not a domain', 'localhost', '']) {
      expect(() => shared.feedbackReplyAddress(token, domain)).toThrow();
      expect(() => feedbackReplyAddress(token, domain)).toThrow();
    }
  });
});
