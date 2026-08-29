import { describe, expect, it } from 'vitest';
import type {
  AlertDeliveryAttempt,
  IBillingAlertRepository,
  ListDueAlertsInput,
  PendingBillingAlert,
  RaiseBillingAlertInput,
} from '@/interfaces/repositories/IBillingAlertRepository';
import { alertDeliveryRetryMs, type BillingAlertSnapshot } from './billing-alerts';
import {
  sweepBillingAlerts,
  type AlertDispatchOutcome,
  type AlertingDeps,
  type BillingAlertChannel,
} from './raise-alerts';

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

const QUIET: BillingAlertSnapshot = {
  paidButUnfulfilled: 0,
  attemptsInReview: 0,
  attemptsIndeterminate: 0,
  inboxOrphaned: 0,
  inboxDeadLettered: 0,
  webhooksUnsupportedSchema: 0,
  webhooksUnauthenticatedRecent: 0,
};

interface StoredAlert extends PendingBillingAlert {
  /** Mutable here: a refusal increments it, which is what the backoff reads. */
  deliveryAttempts: number;
  cooldownUntilMs: number;
  dispatchedAtMs: number | null;
  retryAtMs: number | null;
  blocker: string | null;
}

/**
 * An outbox that models what the real collection does, field for field.
 *
 * Two properties, because both are load-bearing and neither is expressible in
 * the service under test. The conditional upsert: a key inside its cooldown
 * cannot be raised again, whoever asks and however many times. And the delivery
 * queue: `dispatchedAtMs` is written on success and only on success, a refusal
 * writes a retry time instead, and the queue is what is undelivered *and* due.
 *
 * That second property is why this class mirrors the update operators rather
 * than paraphrasing them. A double that retires a row on failure — or one that
 * keeps it when the real `updateOne` retires it — turns this suite into a test
 * of the double, and the divergence is invisible from here: every assertion
 * below passed against a repository that dropped blocked alerts on the floor.
 */
class FakeAlertOutbox implements IBillingAlertRepository {
  readonly rows = new Map<string, StoredAlert>();
  private sequence = 0;

  async raise(input: RaiseBillingAlertInput): Promise<PendingBillingAlert | null> {
    const existing = this.rows.get(input.key);
    if (existing && existing.cooldownUntilMs > input.nowMs) return null;
    this.sequence += 1;
    const row: StoredAlert = {
      alertRef: `alert-${this.sequence}`,
      key: input.key,
      severity: input.severity,
      summary: input.summary,
      action: input.action,
      observed: input.observed,
      raisedAtMs: input.nowMs,
      cooldownUntilMs: input.nowMs + input.cooldownMs,
      // A re-raise clears the previous delivery verdict, its backoff and its
      // attempt count, exactly as the repository's $unset does.
      deliveryAttempts: 0,
      dispatchedAtMs: null,
      retryAtMs: null,
      blocker: null,
    };
    this.rows.set(input.key, row);
    return row;
  }

  async listDueForDelivery(input: ListDueAlertsInput): Promise<PendingBillingAlert[]> {
    return [...this.rows.values()]
      .filter((row) => row.dispatchedAtMs === null)
      .filter((row) => row.retryAtMs === null || row.retryAtMs <= input.nowMs)
      .sort((left, right) => left.raisedAtMs - right.raisedAtMs)
      .slice(0, input.limit);
  }

  async recordDeliveryAttempt(attempt: AlertDeliveryAttempt): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.alertRef !== attempt.alertRef) continue;
      if (attempt.outcome === 'delivered') {
        row.dispatchedAtMs = attempt.atMs;
        row.retryAtMs = null;
        row.blocker = null;
        continue;
      }
      // Refused: the row keeps its absent `dispatchedAtMs` and therefore its
      // place in the queue, behind the backoff it just earned.
      row.blocker = attempt.blocker;
      row.retryAtMs = attempt.retryAtMs;
      row.deliveryAttempts += 1;
    }
  }
}

class RecordingChannel implements BillingAlertChannel {
  readonly delivered: PendingBillingAlert[] = [];
  /** Every call, refused ones included: what the backoff is meant to bound. */
  attempts = 0;

  constructor(private readonly blocker: string | null = null) {}

  async deliver(alert: PendingBillingAlert): Promise<AlertDispatchOutcome> {
    this.attempts += 1;
    if (this.blocker !== null) return { blocker: this.blocker };
    this.delivered.push(alert);
    return { blocker: null };
  }
}

interface Harness {
  alerts: FakeAlertOutbox;
  channel: RecordingChannel;
  deps: AlertingDeps;
  setNow: (atMs: number) => void;
  setHealth: (snapshot: Partial<BillingAlertSnapshot>) => void;
}

function harness(
  snapshot: Partial<BillingAlertSnapshot> = {},
  channel = new RecordingChannel(),
): Harness {
  const alerts = new FakeAlertOutbox();
  let nowMs = NOW;
  let health: BillingAlertSnapshot = { ...QUIET, ...snapshot };
  return {
    alerts,
    channel,
    setNow: (atMs) => {
      nowMs = atMs;
    },
    setHealth: (next) => {
      health = { ...QUIET, ...next };
    },
    deps: {
      alerts,
      channel,
      clock: () => nowMs,
      health: async () => health,
    },
  };
}

/**
 * Detection must never depend on delivery. That is the whole reason the alert
 * is written to an outbox before anything tries to send it: an installation
 * with no ops channel is a supported installation, and it has to degrade to
 * "raised, not delivered" rather than to "not raised".
 */
describe('sweeping the billing alerts', () => {
  it('raises nothing when every counter is clean', async () => {
    const { deps, channel } = harness();

    await expect(sweepBillingAlerts(deps)).resolves.toEqual({
      raised: 0,
      delivered: 0,
      blocked: 0,
      blockers: [],
    });
    expect(channel.delivered).toHaveLength(0);
  });

  it('raises and delivers each tripped condition once', async () => {
    const { deps, channel } = harness({ paidButUnfulfilled: 3, attemptsInReview: 1 });

    const result = await sweepBillingAlerts(deps);

    expect(result).toEqual({ raised: 2, delivered: 2, blocked: 0, blockers: [] });
    expect(channel.delivered.map((alert) => alert.key)).toEqual([
      'paid_but_unfulfilled',
      'attempts_in_review',
    ]);
  });
});

describe('the cooldown', () => {
  it('announces a standing backlog once, not once per scheduler tick', async () => {
    const { deps, channel } = harness({ paidButUnfulfilled: 2 });

    await sweepBillingAlerts(deps);
    const second = await sweepBillingAlerts(deps);
    const third = await sweepBillingAlerts(deps);

    expect(second.raised).toBe(0);
    expect(third.raised).toBe(0);
    expect(channel.delivered).toHaveLength(1);
  });

  it('says it again once the window has passed and the condition still stands', async () => {
    const { deps, setNow, channel } = harness({ paidButUnfulfilled: 2 });
    await sweepBillingAlerts(deps);

    setNow(NOW + 6 * 60 * 60_000 + 1);
    const later = await sweepBillingAlerts(deps);

    expect(later.raised).toBe(1);
    expect(channel.delivered).toHaveLength(2);
  });

  it('holds a warning quiet for a full day, not six hours', async () => {
    const { deps, setNow } = harness({ attemptsInReview: 1 });
    await sweepBillingAlerts(deps);

    setNow(NOW + 6 * 60 * 60_000 + 1);
    expect((await sweepBillingAlerts(deps)).raised).toBe(0);
    setNow(NOW + 24 * 60 * 60_000 + 1);
    expect((await sweepBillingAlerts(deps)).raised).toBe(1);
  });

  it('produces one alert when two schedulers sweep at the same instant', async () => {
    const { alerts, deps } = harness({ inboxDeadLettered: 4 });

    const [left, right] = await Promise.all([sweepBillingAlerts(deps), sweepBillingAlerts(deps)]);

    expect(left.raised + right.raised).toBe(1);
    expect(alerts.rows.size).toBe(1);
  });
});

describe('when the channel is not configured', () => {
  it('still raises the alert and reports the exact blocker', async () => {
    // The failure being fenced: a missing environment variable that made a
    // healthy system and a broken one look identical.
    const { deps, alerts } = harness(
      { paidButUnfulfilled: 1 },
      new RecordingChannel('BILLING_ALERT_EMAIL is not configured'),
    );

    const result = await sweepBillingAlerts(deps);

    expect(result.raised).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.blockers).toEqual(['BILLING_ALERT_EMAIL is not configured']);
    expect(alerts.rows.get('paid_but_unfulfilled')?.blocker).toBe(
      'BILLING_ALERT_EMAIL is not configured',
    );
  });

  it('reports each distinct blocker once however many alerts hit it', async () => {
    const { deps } = harness(
      { paidButUnfulfilled: 1, inboxDeadLettered: 2, attemptsInReview: 3 },
      new RecordingChannel('MAIL_FROM is not configured'),
    );

    const result = await sweepBillingAlerts(deps);

    expect(result.raised).toBe(3);
    expect(result.blockers).toEqual(['MAIL_FROM is not configured']);
  });

  it('leaves a refused alert in the queue rather than marking it delivered', async () => {
    // The bug this pins: the repository set `dispatchedAt` on every attempt,
    // blocked or not, so a refused alert left the queue and could not be
    // retried. Nothing downstream could tell it apart from a delivered one.
    const { deps, alerts, setNow } = harness(
      { paidButUnfulfilled: 1 },
      new RecordingChannel('MAIL_FROM is not configured'),
    );

    const result = await sweepBillingAlerts(deps);
    expect(result.blocked).toBe(1);

    const row = alerts.rows.get('paid_but_unfulfilled');
    expect(row?.dispatchedAtMs).toBeNull();
    expect(row?.deliveryAttempts).toBe(1);

    setNow(NOW + alertDeliveryRetryMs(0));
    expect(
      await alerts.listDueForDelivery({ nowMs: NOW + alertDeliveryRetryMs(0), limit: 20 }),
    ).toHaveLength(1);
  });

  it('delivers a blocked backlog once the channel comes back', async () => {
    // The alert was raised while nothing could send it. It must go out on the
    // next due tick without waiting for the cooldown or for the condition to
    // trip again — otherwise a misconfiguration silently eats the one alert
    // that mattered.
    const blocked = harness(
      { paidButUnfulfilled: 1 },
      new RecordingChannel('BILLING_ALERT_EMAIL is not configured'),
    );
    await sweepBillingAlerts(blocked.deps);
    blocked.setNow(NOW + alertDeliveryRetryMs(0));

    const working = new RecordingChannel();
    const recovered = await sweepBillingAlerts({ ...blocked.deps, channel: working });

    expect(recovered.raised).toBe(0);
    expect(recovered.delivered).toBe(1);
    expect(working.delivered[0]?.key).toBe('paid_but_unfulfilled');
    expect(blocked.alerts.rows.get('paid_but_unfulfilled')?.dispatchedAtMs).not.toBeNull();
  });

  it('does not ask a broken channel again before the backoff has passed', async () => {
    // Retrying is the point, but retrying on every scheduler tick would turn one
    // misconfiguration into a per-minute delivery attempt for as long as it
    // stands. The wait is what makes keeping the alert queued affordable.
    const { deps, channel, setNow } = harness(
      { paidButUnfulfilled: 1 },
      new RecordingChannel('MAIL_FROM is not configured'),
    );
    await sweepBillingAlerts(deps);

    setNow(NOW + alertDeliveryRetryMs(0) - 1);
    const tooSoon = await sweepBillingAlerts(deps);

    expect(tooSoon.blocked).toBe(0);
    expect(tooSoon.blockers).toEqual([]);
    expect(channel.attempts).toBe(1);
  });

  it('backs off further with each refusal, up to a ceiling', async () => {
    // A channel that has refused ten times is not about to accept on the
    // eleventh minute, and the ceiling is the worst case between fixing it and
    // hearing what was waiting.
    expect(alertDeliveryRetryMs(0)).toBeLessThan(alertDeliveryRetryMs(1));
    expect(alertDeliveryRetryMs(1)).toBeLessThan(alertDeliveryRetryMs(2));
    expect(alertDeliveryRetryMs(50)).toBe(alertDeliveryRetryMs(500));
    expect(alertDeliveryRetryMs(-1)).toBe(alertDeliveryRetryMs(0));
  });
});
