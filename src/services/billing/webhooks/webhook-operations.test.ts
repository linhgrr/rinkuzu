import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import type {
  AdminAuditEntry,
  IAdminAuditRepository,
} from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IWebhookInboxRepository,
  PersistedWebhookResult,
  RecordPaymentEventInput,
  RecordWebhookDiagnosticInput,
  RequeueWebhookInput,
  ResolveReplayedWebhookInput,
  WebhookInboxRow,
} from '@/interfaces/repositories/IWebhookInboxRepository';
import type { SigningKey } from '../billing-config';
import { sealWebhookPayload } from '../domain/webhook-payload-cipher';
import {
  replayWebhookEvent,
  revealRetainedWebhookPayload,
  type WebhookOperationDeps,
} from './webhook-operations';

const OPERATOR = { id: 'admin-1', email: 'ops@example.test' };
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const KEY: SigningKey = { kid: 'v1', secret: 'payload-key-with-at-least-32-characters!!' };
const OTHER_KEY: SigningKey = { kid: 'v2', secret: 'another-key-with-at-least-32-characters!!' };
const CHECKSUM_KEY = 'test-checksum-key-with-at-least-32-characters';

/** Signs a body exactly as PayOS does, so the parser accepts it. */
function signedBody(data: Record<string, unknown>): string {
  const payload = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${data[key] ?? ''}`)
    .join('&');
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data,
    signature: crypto.createHmac('sha256', CHECKSUM_KEY).update(payload).digest('hex'),
  });
}

const PAYMENT_BODY = signedBody({
  amount: 99_000,
  code: '00',
  currency: 'VND',
  orderCode: 4242,
  paymentLinkId: 'payment-link',
  reference: 'transaction-reference',
  transactionDateTime: '2026-08-28T09:00:00Z',
});

class FakeAudit implements IAdminAuditRepository {
  readonly entries: AdminAuditEntry[] = [];

  async record(entry: AdminAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

class FakeInbox implements IWebhookInboxRepository {
  readonly rows = new Map<string, WebhookInboxRow>();
  readonly recordedEvents: RecordPaymentEventInput[] = [];
  readonly requeued: RequeueWebhookInput[] = [];
  readonly resolved: ResolveReplayedWebhookInput[] = [];
  /** Modelled as a race: the row left `fromStatuses` before the write landed. */
  requeueSucceeds = true;
  duplicateEvent = false;

  seed(row: WebhookInboxRow): WebhookInboxRow {
    this.rows.set(row.inboxRef, row);
    return row;
  }

  async recordPaymentEvent(input: RecordPaymentEventInput): Promise<PersistedWebhookResult> {
    this.recordedEvents.push(input);
    return { duplicate: this.duplicateEvent, inboxId: 'inbox-new' };
  }

  async recordDiagnostic(_input: RecordWebhookDiagnosticInput): Promise<PersistedWebhookResult> {
    throw new Error('the diagnostic path is not exercised by these tests');
  }

  async findRow(inboxRef: string): Promise<WebhookInboxRow | null> {
    return this.rows.get(inboxRef) ?? null;
  }

  async requeue(input: RequeueWebhookInput): Promise<boolean> {
    this.requeued.push(input);
    return this.requeueSucceeds;
  }

  async resolveReplayed(input: ResolveReplayedWebhookInput): Promise<boolean> {
    this.resolved.push(input);
    return true;
  }
}

interface Harness {
  inbox: FakeInbox;
  audit: FakeAudit;
  deps: WebhookOperationDeps;
}

function harness(keys: readonly SigningKey[] = [KEY]): Harness {
  const inbox = new FakeInbox();
  const audit = new FakeAudit();
  return {
    inbox,
    audit,
    deps: { inbox, audit, clock: () => NOW, payloadKeys: () => keys },
  };
}

function retainedRow(overrides: Partial<WebhookInboxRow> = {}): WebhookInboxRow {
  return {
    inboxRef: 'inbox-1',
    status: 'dead_letter',
    verificationClass: 'unsupported_schema',
    orderCode: null,
    sealedPayload: sealWebhookPayload(PAYMENT_BODY, [KEY]),
    ...overrides,
  };
}

/**
 * Retention that nothing can read is a liability with no upside, and a replay
 * that means editing a status by hand is an unauditable write in the one
 * collection where an unauditable write is indistinguishable from an attack.
 * These two operations exist so neither is true, and every test here is about
 * the fact that they are *recorded* as much as that they work.
 */
describe('revealing a retained webhook body', () => {
  it('opens exactly the row that was asked for and writes down who asked', async () => {
    const { inbox, audit, deps } = harness();
    inbox.seed(retainedRow());

    const reveal = await revealRetainedWebhookPayload(deps, {
      inboxRef: 'inbox-1',
      operator: OPERATOR,
    });

    expect(reveal.payload).toBe(PAYMENT_BODY);
    expect(reveal.retained).toBe(true);
    expect(reveal.unreadable).toBe(false);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      actorId: 'admin-1',
      action: 'billing.webhook.payload_revealed',
      entityType: 'payment_webhook_inbox',
      entityId: 'inbox-1',
    });
  });

  it('records the attempt even when no configured key opens the body', async () => {
    // An ordinary outcome after a payload-key rotation, not a fault — but the
    // attempt is still the auditable event. Auditing only successes leaves
    // "who tried to read this?" unanswerable.
    const { inbox, audit, deps } = harness([OTHER_KEY]);
    inbox.seed(retainedRow());

    const reveal = await revealRetainedWebhookPayload(deps, {
      inboxRef: 'inbox-1',
      operator: OPERATOR,
    });

    expect(reveal.payload).toBeNull();
    expect(reveal.unreadable).toBe(true);
    expect(audit.entries[0]?.details).toMatchObject({ readable: 'false', retained: 'true' });
  });

  it('reports a row with no retained body without pretending one was hidden', async () => {
    const { inbox, audit, deps } = harness();
    inbox.seed(retainedRow({ sealedPayload: null, verificationClass: 'unauthenticated' }));

    const reveal = await revealRetainedWebhookPayload(deps, {
      inboxRef: 'inbox-1',
      operator: OPERATOR,
    });

    expect(reveal).toEqual({
      inboxRef: 'inbox-1',
      payload: null,
      retained: false,
      unreadable: false,
    });
    expect(audit.entries).toHaveLength(1);
  });

  it('refuses an unknown row rather than auditing a read that never happened', async () => {
    const { audit, deps } = harness();

    await expect(
      revealRetainedWebhookPayload(deps, { inboxRef: 'missing', operator: OPERATOR }),
    ).rejects.toMatchObject({ code: 'not_found', status: 404 });
    expect(audit.entries).toHaveLength(0);
  });
});

describe('replaying a stalled webhook', () => {
  it('puts a row that names an order back into the drain queue', async () => {
    const { inbox, audit, deps } = harness();
    inbox.seed(retainedRow({ orderCode: 4242, sealedPayload: null }));

    const result = await replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR });

    expect(result).toEqual({ inboxRef: 'inbox-1', outcome: 'requeued', duplicate: false });
    // Nothing is posted back at the public endpoint: that would mean forging a
    // signature and opening a second unauthenticated path into settlement.
    expect(inbox.requeued).toEqual([
      {
        inboxRef: 'inbox-1',
        fromStatuses: ['retryable_failure', 'dead_letter', 'orphaned', 'permanent_failure'],
        nowMs: NOW,
        replayedBy: 'admin-1',
      },
    ]);
    expect(audit.entries[0]).toMatchObject({ action: 'billing.webhook.replayed' });
  });

  it('re-reads a retained body with the current parser and records the event', async () => {
    // The entire reason the body is kept: the schema of the day could not read
    // it, today's can, and the payment it always was becomes an event.
    process.env['PAYOS_CHECKSUM_KEY'] = CHECKSUM_KEY;
    try {
      const { inbox, deps } = harness();
      inbox.seed(retainedRow());

      const result = await replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR });

      expect(result.outcome).toBe('reclassified');
      expect(inbox.recordedEvents).toHaveLength(1);
      expect(inbox.recordedEvents[0]).toMatchObject({
        orderCode: 4242,
        amount: 99_000,
        reference: 'transaction-reference',
      });
      // A replay is the operator's action, not a delivery from anywhere.
      expect(inbox.recordedEvents[0]?.facts.sourceIpHash).toBeNull();
      expect(inbox.resolved).toHaveLength(1);
    } finally {
      delete process.env['PAYOS_CHECKSUM_KEY'];
    }
  });

  it('reports a reclassified event that collapsed onto one already recorded', async () => {
    // Idempotency is the provider's own transaction reference, so replaying a
    // body whose money is already recorded changes nothing and says so.
    process.env['PAYOS_CHECKSUM_KEY'] = CHECKSUM_KEY;
    try {
      const { inbox, deps } = harness();
      inbox.seed(retainedRow());
      inbox.duplicateEvent = true;

      const result = await replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR });

      expect(result).toMatchObject({ outcome: 'reclassified', duplicate: true });
    } finally {
      delete process.env['PAYOS_CHECKSUM_KEY'];
    }
  });

  it('refuses a row that is not waiting on a replay', async () => {
    const { inbox, audit, deps } = harness();
    inbox.seed(retainedRow({ status: 'processed', orderCode: 4242 }));

    await expect(
      replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
    ).rejects.toMatchObject({ code: 'webhook_not_replayable', status: 409 });
    expect(audit.entries).toHaveLength(0);
  });

  it('produces one replay when two operators press it together', async () => {
    // The conditional requeue is the whole mechanism: the second write matches
    // nothing because the row already left the replayable states.
    const { inbox, deps } = harness();
    inbox.seed(retainedRow({ orderCode: 4242, sealedPayload: null }));
    inbox.requeueSucceeds = false;

    await expect(
      replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
    ).rejects.toMatchObject({ code: 'webhook_not_replayable', status: 409 });
  });

  it('refuses a row with neither an order code nor a retained body', async () => {
    const { inbox, deps } = harness();
    inbox.seed(retainedRow({ sealedPayload: null }));

    await expect(
      replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
    ).rejects.toMatchObject({ code: 'webhook_not_replayable' });
  });

  it('refuses a retained body no configured key opens', async () => {
    const { inbox, deps } = harness([OTHER_KEY]);
    inbox.seed(retainedRow());

    await expect(
      replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
    ).rejects.toMatchObject({ code: 'webhook_payload_unreadable', status: 409 });
  });

  it('refuses a retained body this version still cannot read', async () => {
    process.env['PAYOS_CHECKSUM_KEY'] = CHECKSUM_KEY;
    try {
      const { inbox, deps } = harness();
      const unparseable = signedBody({ orderCode: 4242, code: '00' });
      inbox.seed(retainedRow({ sealedPayload: sealWebhookPayload(unparseable, [KEY]) }));

      await expect(
        replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
      ).rejects.toMatchObject({ code: 'webhook_still_unsupported', status: 409 });
    } finally {
      delete process.env['PAYOS_CHECKSUM_KEY'];
    }
  });

  it('never records an event from a body whose signature does not verify', async () => {
    // The retained body is attacker-controlled text that happened to verify
    // once. If the key has changed since, replaying it must not settle money.
    process.env['PAYOS_CHECKSUM_KEY'] = 'a-completely-different-checksum-key-value';
    try {
      const { inbox, deps } = harness();
      inbox.seed(retainedRow());

      await expect(
        replayWebhookEvent(deps, { inboxRef: 'inbox-1', operator: OPERATOR }),
      ).rejects.toMatchObject({ code: 'webhook_still_unsupported' });
      expect(inbox.recordedEvents).toHaveLength(0);
    } finally {
      delete process.env['PAYOS_CHECKSUM_KEY'];
    }
  });
});
