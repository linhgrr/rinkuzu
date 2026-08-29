import { describe, expect, it } from 'vitest';
import {
  classifyFulfillmentFailure,
  decideFulfillment,
  FULFILLMENT_STATES,
} from './fulfillment-decision';

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

// The conflict vocabulary and the attempt ceiling are stated here rather than
// imported: these are the policy this suite exists to pin, so widening the
// module's list must fail here until the case is deliberately covered.
const ENTITLEMENT_CONFLICT_CODES = [
  'already_has_perpetual_entitlement',
  'entitlement_replay_limit',
] as const;
const MAX_FULFILLMENT_ATTEMPTS = 10;

describe('decideFulfillment', () => {
  it('refuses to grant an order whose net settlement does not cover what it is owed', () => {
    // The regression this pins: the decision used to key off the *collection*
    // status, so an order the provider had collected in full and then refunded
    // was still `paid` and was granted Premium anyway.
    const decision = decideFulfillment({
      entitled: false,
      collectionUnderReview: false,
      fulfillment: 'unfulfilled',
      autoActivationEnabled: true,
    });
    expect(decision).toEqual({ kind: 'skip', reason: 'not_entitled' });
  });

  it('grants an underpaid order that a merchant credit made whole', () => {
    // The mirror image: entitlement follows the net ledger, so money the
    // merchant granted counts exactly as a payment would.
    expect(
      decideFulfillment({
        entitled: true,
        collectionUnderReview: false,
        fulfillment: 'unfulfilled',
        autoActivationEnabled: true,
      }),
    ).toEqual({ kind: 'grant' });
  });

  it('grants only from the two states that still owe an entitlement', () => {
    for (const fulfillment of FULFILLMENT_STATES) {
      const decision = decideFulfillment({
        entitled: true,
        collectionUnderReview: false,
        fulfillment,
        autoActivationEnabled: true,
      });
      const grantable = fulfillment === 'unfulfilled' || fulfillment === 'processing';
      expect(decision.kind).toBe(grantable ? 'grant' : 'skip');
    }
  });

  it('leaves an order an operator has taken over alone, entitled or not', () => {
    for (const entitled of [true, false]) {
      expect(
        decideFulfillment({
          entitled,
          collectionUnderReview: true,
          fulfillment: 'unfulfilled',
          autoActivationEnabled: true,
        }),
      ).toEqual({ kind: 'skip', reason: 'operator_owned' });
    }
  });

  it('leaves an order in fulfillment review alone', () => {
    expect(
      decideFulfillment({
        entitled: true,
        collectionUnderReview: false,
        fulfillment: 'review',
        autoActivationEnabled: true,
      }),
    ).toEqual({ kind: 'skip', reason: 'operator_owned' });
  });

  it('never grants twice for an order already fulfilled or revoked', () => {
    for (const fulfillment of ['fulfilled', 'revoked'] as const) {
      expect(
        decideFulfillment({
          entitled: true,
          collectionUnderReview: false,
          fulfillment,
          autoActivationEnabled: true,
        }),
      ).toEqual({ kind: 'skip', reason: 'already_fulfilled' });
    }
  });

  it('withholds the grant from an unentitled order before it even considers deferring', () => {
    // Order matters: parking money as "awaiting manual activation" for an order
    // that has been refunded would leave an operator a queue item to grant.
    expect(
      decideFulfillment({
        entitled: false,
        collectionUnderReview: false,
        fulfillment: 'unfulfilled',
        autoActivationEnabled: false,
      }),
    ).toEqual({ kind: 'skip', reason: 'not_entitled' });
  });

  it('parks the money instead of granting when automatic activation is off', () => {
    expect(
      decideFulfillment({
        entitled: true,
        collectionUnderReview: false,
        fulfillment: 'unfulfilled',
        autoActivationEnabled: false,
      }),
    ).toEqual({ kind: 'defer' });
  });
});

describe('classifyFulfillmentFailure', () => {
  it('sends an expected entitlement conflict to review, keeping the money committed', () => {
    for (const code of ENTITLEMENT_CONFLICT_CODES) {
      expect(
        classifyFulfillmentFailure({
          code,
          attemptCount: 0,
          nowMs: NOW,
          collectedAtMs: NOW - 60_000,
          random: () => 0.5,
        }),
      ).toEqual({ kind: 'review', reason: code });
    }
  });

  it('retries anything unclassified with a strictly future follow-up', () => {
    for (const code of [null, 'mongo_timeout', 'provider_unavailable']) {
      const outcome = classifyFulfillmentFailure({
        code,
        attemptCount: 1,
        nowMs: NOW,
        collectedAtMs: NOW - 60_000,
        random: () => 0.5,
      });
      if (outcome.kind !== 'retry') throw new Error('expected retry');
      expect(outcome.followUp.atMs).toBeGreaterThan(NOW);
    }
  });

  it('stops a poison order once its attempts are spent instead of retrying forever', () => {
    expect(
      classifyFulfillmentFailure({
        code: 'mongo_timeout',
        attemptCount: MAX_FULFILLMENT_ATTEMPTS,
        nowMs: NOW,
        collectedAtMs: NOW - 60_000,
        random: () => 0.5,
      }),
    ).toEqual({ kind: 'review', reason: 'fulfillment_attempts_exhausted' });
  });
});

describe('unclassified failure codes', () => {
  it('treats a code that merely looks like a conflict as transient, not as review', () => {
    const outcome = classifyFulfillmentFailure({
      code: 'entitlement_write_conflict',
      attemptCount: 0,
      nowMs: NOW,
      collectedAtMs: NOW - 60_000,
      random: () => 0.5,
    });
    expect(outcome.kind).toBe('retry');
  });
});
