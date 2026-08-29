import { describe, expect, it } from 'vitest';
import {
  clampUnsupportedRetentionDays,
  UNSUPPORTED_RETENTION_DAYS_DEFAULT,
  WEBHOOK_VERIFICATION_CLASSES,
  webhookRetainUntilMs,
  webhookRetentionPolicy,
} from './webhook-diagnostics';

const NOW_MS = Date.UTC(2026, 7, 28);
const DAY_MS = 86_400_000;

function policyFor(
  verificationClass: (typeof WEBHOOK_VERIFICATION_CLASSES)[number],
  unsupportedRetentionDays = UNSUPPORTED_RETENTION_DAYS_DEFAULT,
) {
  return webhookRetentionPolicy({ verificationClass, unsupportedRetentionDays });
}

/**
 * The endpoint is an unauthenticated door, so retention is a security decision
 * before it is an operational one. These tests pin the two halves of that: that
 * only the one class worth keeping is kept, and that the class most likely to
 * be attacker-supplied is the one that can never leave text behind.
 */
describe('raw body retention', () => {
  it('keeps a body only for a signature-valid payload it could not parse', () => {
    const retaining = WEBHOOK_VERIFICATION_CLASSES.filter(
      (verificationClass) => policyFor(verificationClass).retainRawBody === 'encrypted',
    );
    expect(retaining).toEqual(['unsupported_schema']);
  });

  it('never retains the body of traffic it could not authenticate', () => {
    // This is the class an attacker controls end to end. Storing its text would
    // turn a public endpoint into a writable store of arbitrary content.
    expect(policyFor('unauthenticated').retainRawBody).toBe('never');
  });

  it('never stores a body in the clear', () => {
    for (const verificationClass of WEBHOOK_VERIFICATION_CLASSES) {
      expect(policyFor(verificationClass).retainRawBody).not.toBe('plaintext');
    }
  });
});

describe('row retention windows', () => {
  it('keeps an accepted payment event as a business record with no expiry', () => {
    const policy = policyFor('accepted');
    expect(policy.retentionDays).toBeNull();
    expect(webhookRetainUntilMs(NOW_MS, policy)).toBeNull();
  });

  it('expires every diagnostic class', () => {
    for (const verificationClass of ['ignored', 'unsupported_schema', 'unauthenticated'] as const) {
      const policy = policyFor(verificationClass);
      expect(policy.retentionDays).toBeGreaterThan(0);
      expect(webhookRetainUntilMs(NOW_MS, policy)).toBeGreaterThan(NOW_MS);
    }
  });

  it('ages unauthenticated traffic out faster than authenticated notices', () => {
    const unauthenticated = policyFor('unauthenticated').retentionDays;
    const ignored = policyFor('ignored').retentionDays;
    expect(unauthenticated).not.toBeNull();
    expect(ignored).not.toBeNull();
    expect(unauthenticated as number).toBeLessThan(ignored as number);
  });

  it('converts a window into a deadline in whole days', () => {
    expect(webhookRetainUntilMs(NOW_MS, { retainRawBody: 'never', retentionDays: 30 })).toBe(
      NOW_MS + 30 * DAY_MS,
    );
  });
});

describe('the operator-configurable window', () => {
  it('clamps a configured value into its supported range', () => {
    expect(clampUnsupportedRetentionDays(0)).toBe(1);
    expect(clampUnsupportedRetentionDays(-5)).toBe(1);
    expect(clampUnsupportedRetentionDays(1_000)).toBe(90);
    expect(clampUnsupportedRetentionDays(45)).toBe(45);
    expect(clampUnsupportedRetentionDays(45.9)).toBe(45);
  });

  it('falls back to the default rather than to forever on a non-finite value', () => {
    // A misconfigured value must never become "keep this text indefinitely".
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(clampUnsupportedRetentionDays(value)).toBe(UNSUPPORTED_RETENTION_DAYS_DEFAULT);
    }
  });

  it('bounds the retained-body window however it is configured', () => {
    for (const configured of [Number.NaN, -100, 0, 1, 30, 91, 10_000]) {
      const policy = policyFor('unsupported_schema', configured);
      expect(policy.retentionDays).not.toBeNull();
      expect(policy.retentionDays as number).toBeGreaterThanOrEqual(1);
      expect(policy.retentionDays as number).toBeLessThanOrEqual(90);
    }
  });
});
