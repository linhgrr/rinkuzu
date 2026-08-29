import { describe, expect, it } from 'vitest';
import {
  alertCooldownMs,
  BILLING_ALERT_KEYS,
  evaluateBillingAlerts,
  type BillingAlertKey,
  type BillingAlertSnapshot,
} from './billing-alerts';

const QUIET: BillingAlertSnapshot = {
  paidButUnfulfilled: 0,
  attemptsInReview: 0,
  attemptsIndeterminate: 0,
  inboxOrphaned: 0,
  inboxDeadLettered: 0,
  webhooksUnsupportedSchema: 0,
  webhooksUnauthenticatedRecent: 0,
};

function keysFor(snapshot: Partial<BillingAlertSnapshot>): BillingAlertKey[] {
  return evaluateBillingAlerts({ ...QUIET, ...snapshot }).map((alert) => alert.key);
}

/**
 * The counters these rules read were already on the admin page, and a counter
 * on a page nobody has open is not an alert. What makes this module worth
 * having is that each condition has a threshold chosen for what it means: one
 * paid-but-unfulfilled order is an emergency, one unauthenticated delivery is
 * the internet.
 */
describe('when nothing is wrong', () => {
  it('raises nothing at all', () => {
    expect(evaluateBillingAlerts(QUIET)).toEqual([]);
  });
});

describe('conditions that need a person', () => {
  it('raises a critical alert for a single paid order with no Premium', () => {
    // No threshold above one: this is money taken for nothing, and nothing else
    // in the system resolves it.
    const [alert] = evaluateBillingAlerts({ ...QUIET, paidButUnfulfilled: 1 });
    expect(alert).toMatchObject({
      key: 'paid_but_unfulfilled',
      severity: 'critical',
      observed: 1,
      threshold: 1,
    });
    expect(alert?.action).toContain('billing admin');
  });

  it('raises on the first dead-lettered or unreadable webhook', () => {
    expect(keysFor({ inboxDeadLettered: 1 })).toEqual(['webhook_dead_lettered']);
    expect(keysFor({ webhooksUnsupportedSchema: 1 })).toEqual(['webhook_unsupported_schema']);
  });

  it('raises on the first attempt waiting on an operator', () => {
    expect(keysFor({ attemptsInReview: 1 })).toEqual(['attempts_in_review']);
  });
});

describe('conditions that only matter in bulk', () => {
  it('treats a handful of failed signature checks as internet noise', () => {
    // Anyone can post to the endpoint. A few rejections a day say nothing; ten
    // in a day with real traffic means the checksum key no longer matches.
    expect(keysFor({ webhooksUnauthenticatedRecent: 9 })).toEqual([]);
    expect(keysFor({ webhooksUnauthenticatedRecent: 10 })).toEqual(['webhook_checksum_failures']);
  });

  it('waits for a pile of orphaned deliveries rather than a timing artefact', () => {
    expect(keysFor({ inboxOrphaned: 4 })).toEqual([]);
    expect(keysFor({ inboxOrphaned: 5 })).toEqual(['webhook_orphaned']);
  });

  it('waits for a pattern of unconfirmed checkout links', () => {
    expect(keysFor({ attemptsIndeterminate: 2 })).toEqual([]);
    expect(keysFor({ attemptsIndeterminate: 3 })).toEqual(['attempts_indeterminate']);
  });
});

describe('the shape of what is raised', () => {
  it('puts every critical condition ahead of every warning', () => {
    const alerts = evaluateBillingAlerts({
      ...QUIET,
      attemptsInReview: 4,
      inboxOrphaned: 9,
      paidButUnfulfilled: 2,
      inboxDeadLettered: 1,
    });
    const severities = alerts.map((alert) => alert.severity);
    expect(severities).toEqual([...severities].sort((left) => (left === 'critical' ? -1 : 1)));
    expect(severities.slice(0, 2)).toEqual(['critical', 'critical']);
  });

  it('gives every key exactly one rule and every rule something to do', () => {
    // A key with no rule is an alert nothing can raise; a rule with no action
    // is a page in the middle of the night with nothing to act on.
    const all = evaluateBillingAlerts({
      paidButUnfulfilled: 1,
      attemptsInReview: 1,
      attemptsIndeterminate: 99,
      inboxOrphaned: 99,
      inboxDeadLettered: 1,
      webhooksUnsupportedSchema: 1,
      webhooksUnauthenticatedRecent: 99,
    });
    expect(new Set(all.map((alert) => alert.key)).size).toBe(all.length);
    expect([...all.map((alert) => alert.key)].sort()).toEqual([...BILLING_ALERT_KEYS].sort());
    for (const alert of all) {
      expect(alert.action.length).toBeGreaterThan(20);
      expect(alert.summary).toContain(String(alert.observed));
    }
  });
});

describe('how long a condition stays quiet', () => {
  it('reminds sooner about money than about a queue', () => {
    expect(alertCooldownMs('critical')).toBe(6 * 60 * 60_000);
    expect(alertCooldownMs('warning')).toBe(24 * 60 * 60_000);
    // Both bounded well under a week: a standing backlog has to say so again.
    expect(alertCooldownMs('warning')).toBeLessThan(7 * 24 * 60 * 60_000);
  });
});
