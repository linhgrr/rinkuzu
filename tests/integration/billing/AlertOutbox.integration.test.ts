import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import { BillingAlert } from '@/models/Billing';
import { BillingAlertRepository } from '@/repositories/billing/BillingAlertRepository';
import type { BillingAlertKey } from '@/services/billing/alerting/billing-alerts';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * The alert outbox against the real collection, because the property that
 * matters is a property of the update operators.
 *
 * The in-memory double for this repository once modelled the intended
 * semantics — a refused delivery stays queued — while the repository set
 * `dispatchedAt` on every attempt and dropped the alert out of the queue. Both
 * were self-consistent, the unit suite was green, and a missing
 * `BILLING_ALERT_EMAIL` silently ate the alert that said money had been taken
 * and nothing granted. Only a test that runs the real `find` against the real
 * `updateOne` can hold the two honest, so the queue transitions are asserted
 * here and not only there.
 */
describe('billing alert outbox integration', () => {
  const repository = new BillingAlertRepository();
  // A real key, since the column is enum-validated; the collection holds one
  // row per key, so the suite clears its own row rather than namespacing it.
  const key: BillingAlertKey = 'attempts_indeterminate';
  const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
  const COOLDOWN_MS = 60 * 60_000;

  async function raiseOne(nowMs = NOW): Promise<string> {
    const raised = await repository.raise({
      key,
      severity: 'warning',
      observed: 4,
      threshold: 3,
      summary: 'integration fixture',
      action: 'nothing; this is a test row',
      nowMs,
      cooldownMs: COOLDOWN_MS,
    });
    if (raised === null) throw new Error('fixture alert was suppressed by its own cooldown');
    return raised.alertRef;
  }

  const dueRefs = async (nowMs: number): Promise<string[]> =>
    (await repository.listDueForDelivery({ nowMs, limit: 20 })).map((alert) => alert.alertRef);

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Billing alert integration database is unavailable', { cause: error });
    }
  }, 15_000);

  afterEach(async () => {
    await BillingAlert.deleteMany({ key });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await BillingAlert.deleteMany({ key });
    await mongoose.disconnect();
  }, 15_000);

  it('offers a freshly raised alert for delivery', async () => {
    const alertRef = await raiseOne();

    expect(await dueRefs(NOW)).toEqual([alertRef]);
  });

  it('retires an alert once a channel has taken it', async () => {
    const alertRef = await raiseOne();

    await repository.recordDeliveryAttempt({ alertRef, outcome: 'delivered', atMs: NOW });

    expect(await dueRefs(NOW)).toEqual([]);
    const row = await BillingAlert.findById(alertRef).lean<Record<string, unknown>>().exec();
    expect(row?.['dispatchedAt']).toBeInstanceOf(Date);
    expect(row?.['dispatchBlocker']).toBeUndefined();
  });

  it('keeps a refused alert queued and hands it back once its backoff expires', async () => {
    // The regression. Before the fix this assertion failed on its first line:
    // the refusal set `dispatchedAt`, so the alert was never offered again and
    // the operator heard nothing until the cooldown lapsed hours later.
    const alertRef = await raiseOne();
    const retryAtMs = NOW + 60_000;

    await repository.recordDeliveryAttempt({
      alertRef,
      outcome: 'blocked',
      atMs: NOW,
      blocker: 'BILLING_ALERT_EMAIL is not configured',
      retryAtMs,
    });

    const row = await BillingAlert.findById(alertRef).lean<Record<string, unknown>>().exec();
    expect(row?.['dispatchedAt']).toBeUndefined();
    expect(row?.['dispatchBlocker']).toBe('BILLING_ALERT_EMAIL is not configured');
    expect(row?.['dispatchAttempts']).toBe(1);

    expect(await dueRefs(retryAtMs - 1)).toEqual([]);
    expect(await dueRefs(retryAtMs)).toEqual([alertRef]);
  });

  it('counts every refusal, so the backoff can widen', async () => {
    const alertRef = await raiseOne();
    for (const attempt of [0, 1, 2]) {
      await repository.recordDeliveryAttempt({
        alertRef,
        outcome: 'blocked',
        atMs: NOW + attempt,
        blocker: 'MAIL_FROM is not configured',
        retryAtMs: NOW + attempt,
      });
    }

    const [due] = await repository.listDueForDelivery({ nowMs: NOW + 10, limit: 20 });
    expect(due?.deliveryAttempts).toBe(3);
  });

  it('clears the delivery verdict when the condition is raised again', async () => {
    // A re-raise is a new thing to deliver. Inheriting the previous refusal's
    // backoff would delay the fresh alert by however long the broken channel
    // had been broken.
    const first = await raiseOne();
    await repository.recordDeliveryAttempt({
      alertRef: first,
      outcome: 'blocked',
      atMs: NOW,
      blocker: 'MAIL_FROM is not configured',
      retryAtMs: NOW + 30 * 60_000,
    });

    const laterMs = NOW + COOLDOWN_MS + 1;
    const second = await raiseOne(laterMs);

    expect(await dueRefs(laterMs)).toEqual([second]);
    const row = await BillingAlert.findById(second).lean<Record<string, unknown>>().exec();
    expect(row?.['dispatchBlocker']).toBeUndefined();
    expect(row?.['dispatchRetryAt']).toBeUndefined();
    expect(row?.['dispatchAttempts']).toBeUndefined();
  });

  it('suppresses a second raise inside the cooldown', async () => {
    await raiseOne();

    await expect(
      repository.raise({
        key,
        severity: 'warning',
        observed: 9,
        threshold: 3,
        summary: 'integration fixture, again',
        action: 'nothing; this is a test row',
        nowMs: NOW + 1,
        cooldownMs: COOLDOWN_MS,
      }),
    ).resolves.toBeNull();
  });
});
