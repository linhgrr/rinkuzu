import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  IWebhookInboxRepository,
  WebhookInboxRow,
} from '@/interfaces/repositories/IWebhookInboxRepository';
import { BillingDomainError } from '../billing-domain';
import type { SigningKey } from '../billing-config';
import { openWebhookPayload } from '../domain/webhook-payload-cipher';
import { classifyPayOSWebhook } from '../payos-webhook';
import { paymentEventFromWebhook } from './payment-event';

/**
 * The two things an operator can do to a webhook row, and the only two.
 *
 * Both used to be a database console: reading a retained body meant decrypting
 * it by hand, and getting a dead-lettered event re-processed meant editing its
 * status directly — an unauditable write, in the one collection where an
 * unauditable write is indistinguishable from an attack. Both are now
 * authenticated actions that leave a record of who took them.
 *
 * Neither re-enters the public endpoint. Posting a body back at ourselves would
 * mean re-deriving a signature we no longer hold and would create a second,
 * unauthenticated path into settlement; a replay works on the row that already
 * exists instead, and idempotency is the provider reference it already carries.
 */

export interface WebhookOperationDeps {
  readonly inbox: IWebhookInboxRepository;
  readonly audit: IAdminAuditRepository;
  readonly clock: () => number;
  readonly payloadKeys: () => readonly SigningKey[];
}

interface WebhookOperator {
  readonly id: string;
  readonly email: string;
}

export interface WebhookOperationCommand {
  readonly inboxRef: string;
  readonly operator: WebhookOperator;
}

export interface RetainedPayloadReveal {
  readonly inboxRef: string;
  /** The verbatim body, or null when none is retained or none can be opened. */
  readonly payload: string | null;
  readonly retained: boolean;
  /** True when a body is stored but no configured key opens it. */
  readonly unreadable: boolean;
}

/** Statuses a stalled row may be put back into the queue from. */
const REQUEUEABLE_STATUSES = [
  'retryable_failure',
  'dead_letter',
  'orphaned',
  'permanent_failure',
] as const;

type WebhookReplayOutcome =
  /** Put back in the drain's queue; the provider's API decides the rest. */
  | 'requeued'
  /** The retained body parsed under the current schema and became an event. */
  | 'reclassified';

export interface WebhookReplayResult {
  readonly inboxRef: string;
  readonly outcome: WebhookReplayOutcome;
  /** Set when a reclassified event collapsed onto one already recorded. */
  readonly duplicate: boolean;
}

async function requireRow(deps: WebhookOperationDeps, inboxRef: string): Promise<WebhookInboxRow> {
  const row = await deps.inbox.findRow(inboxRef);
  if (!row) throw new BillingDomainError('not_found', 'Webhook record not found', 404);
  return row;
}

/**
 * Opens the one webhook body we retain.
 *
 * A signature-valid payload the parser could not read is the only class kept at
 * all, and it is kept sealed. It is provider text that may name a payer, so it
 * is never handed out as part of a list: an operator asks for one row, by id,
 * and the asking is what gets written down.
 */
export async function revealRetainedWebhookPayload(
  deps: WebhookOperationDeps,
  command: WebhookOperationCommand,
): Promise<RetainedPayloadReveal> {
  const row = await requireRow(deps, command.inboxRef);
  const sealed = row.sealedPayload;
  const payload = sealed === null ? null : openWebhookPayload(sealed, deps.payloadKeys());
  // Recorded before the value leaves this function, and recorded whether or not
  // the key still opens it: the attempt is the auditable event, not the success.
  await deps.audit.record({
    actorId: command.operator.id,
    actorEmail: command.operator.email,
    action: 'billing.webhook.payload_revealed',
    entityType: 'payment_webhook_inbox',
    entityId: row.inboxRef,
    details: {
      verificationClass: row.verificationClass,
      retained: String(sealed !== null),
      readable: String(payload !== null),
      ...(sealed === null ? {} : { keyVersion: sealed.keyVersion }),
    },
  });
  return {
    inboxRef: row.inboxRef,
    payload,
    retained: sealed !== null,
    unreadable: sealed !== null && payload === null,
  };
}

/**
 * Gives a stalled webhook row another run.
 *
 * A row that names an order goes back into the drain's queue, and the drain
 * settles it from the provider's API exactly as it would a fresh delivery —
 * which is what keeps a replay idempotent: the money is identified by the
 * provider's own transaction reference, and recording it twice collapses onto
 * the row that already exists.
 *
 * A row that names no order but retained its body is the interesting case. It
 * is there because the schema of the day could not read it; a replay re-reads
 * it with today's parser, and if it now parses, the payment event it always was
 * is recorded. That is the entire reason the body is retained, and until now
 * nothing could act on it.
 */
export async function replayWebhookEvent(
  deps: WebhookOperationDeps,
  command: WebhookOperationCommand,
): Promise<WebhookReplayResult> {
  const row = await requireRow(deps, command.inboxRef);
  if (!(REQUEUEABLE_STATUSES as readonly string[]).includes(row.status)) {
    throw new BillingDomainError(
      'webhook_not_replayable',
      `A webhook in "${row.status}" is not waiting on a replay`,
      409,
    );
  }

  const result =
    row.orderCode === null
      ? await reclassifyRetainedEvent(deps, command, row)
      : await requeueRow(deps, command, row);

  await deps.audit.record({
    actorId: command.operator.id,
    actorEmail: command.operator.email,
    action: 'billing.webhook.replayed',
    entityType: 'payment_webhook_inbox',
    entityId: row.inboxRef,
    details: {
      fromStatus: row.status,
      outcome: result.outcome,
      duplicate: String(result.duplicate),
    },
  });
  return result;
}

async function requeueRow(
  deps: WebhookOperationDeps,
  command: WebhookOperationCommand,
  row: WebhookInboxRow,
): Promise<WebhookReplayResult> {
  const requeued = await deps.inbox.requeue({
    inboxRef: row.inboxRef,
    fromStatuses: REQUEUEABLE_STATUSES,
    nowMs: deps.clock(),
    replayedBy: command.operator.id,
  });
  if (!requeued) {
    throw new BillingDomainError(
      'webhook_not_replayable',
      'The webhook changed state before the replay was applied',
      409,
    );
  }
  return { inboxRef: row.inboxRef, outcome: 'requeued', duplicate: false };
}

async function reclassifyRetainedEvent(
  deps: WebhookOperationDeps,
  command: WebhookOperationCommand,
  row: WebhookInboxRow,
): Promise<WebhookReplayResult> {
  if (row.sealedPayload === null) {
    throw new BillingDomainError(
      'webhook_not_replayable',
      'This webhook names no order and retained no body, so there is nothing to replay',
      409,
    );
  }
  const body = openWebhookPayload(row.sealedPayload, deps.payloadKeys());
  if (body === null) {
    throw new BillingDomainError(
      'webhook_payload_unreadable',
      'The retained body cannot be opened with any configured key',
      409,
    );
  }
  const outcome = classifyPayOSWebhook(body);
  if (outcome.kind !== 'accepted') {
    throw new BillingDomainError(
      'webhook_still_unsupported',
      'The retained body is still not one this version understands',
      409,
    );
  }

  const recorded = await deps.inbox.recordPaymentEvent(
    paymentEventFromWebhook(outcome, {
      rawPayloadHash: outcome.rawPayloadHash,
      byteSizeBytes: outcome.byteSize,
      // The original caller's address is on the row this replay closes; a
      // replay is the operator's action, not a new delivery from anywhere.
      sourceIpHash: null,
    }),
  );
  await deps.inbox.resolveReplayed({
    inboxRef: row.inboxRef,
    nowMs: deps.clock(),
    replayedBy: command.operator.id,
    lastError: `Reclassified on replay as event ${recorded.inboxId}`,
  });
  return { inboxRef: row.inboxRef, outcome: 'reclassified', duplicate: recorded.duplicate };
}
