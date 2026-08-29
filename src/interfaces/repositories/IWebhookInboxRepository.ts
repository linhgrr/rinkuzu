import type {
  WebhookRejectionReason,
  WebhookVerificationClass,
} from '@/services/billing/domain/webhook-diagnostics';
import type { SealedWebhookPayload } from '@/services/billing/domain/webhook-payload-cipher';

/**
 * The durable record of every inbound webhook the endpoint read.
 *
 * A rejection that leaves no trace is the reason a provider key change looks
 * exactly like a port scan: the provider sees a 400 and the operator sees
 * nothing. Every request the endpoint reads therefore produces a row —
 * accepted, ignored, unreadable or unauthenticated alike — and the row carries
 * enough to count and correlate without keeping attacker-controlled text.
 *
 * The two requests that produce no row are the ones refused before the body is
 * read: an oversized body, and a source that has spent its unauthenticated
 * budget. Writing a row for either would hand an anonymous caller exactly the
 * write amplification those limits exist to deny, so the limiter's counters are
 * the record that they happened.
 */

export interface WebhookRequestFacts {
  /** SHA-256 of the verbatim body; the correlation handle for a rejection. */
  readonly rawPayloadHash: string;
  readonly byteSizeBytes: number;
  /** Keyed hash of the caller's address, or null when it cannot be hashed. */
  readonly sourceIpHash: string | null;
}

export interface RecordPaymentEventInput {
  readonly facts: WebhookRequestFacts;
  readonly orderCode: number;
  readonly amount: number;
  readonly currency: string;
  readonly paymentLinkId: string;
  readonly reference: string;
  readonly transactionDateTime: string;
  readonly counterAccountBankId?: string | null | undefined;
  readonly counterAccountNumber?: string | null | undefined;
}

export interface RecordWebhookDiagnosticInput {
  readonly facts: WebhookRequestFacts;
  readonly verificationClass: WebhookVerificationClass;
  /** Set only for the `unauthenticated` class. */
  readonly rejectionReason: WebhookRejectionReason | null;
  /** The provider envelope's own code and text, when the envelope parsed. */
  readonly eventCode: string | null;
  readonly eventDesc: string | null;
  /**
   * The order the notice named, when it named one. An authenticated notice that
   * is not a successful payment still tells us which order to look at, so it is
   * queued as a reconciliation trigger rather than acted on directly: the
   * provider's API stays the authority on what actually happened.
   */
  readonly orderCode: number | null;
  /** The verbatim body. Persisted only where the retention policy allows it. */
  readonly rawBody: string | null;
}

export interface PersistedWebhookResult {
  duplicate: boolean;
  inboxId: string;
}

/**
 * One inbox row, as an operator action needs it. The sealed body is handed over
 * still sealed: opening it is a separate, audited decision, and a port that
 * returned plaintext would make "was this ever revealed?" unanswerable.
 */
export interface WebhookInboxRow {
  readonly inboxRef: string;
  readonly status: string;
  readonly verificationClass: WebhookVerificationClass;
  readonly orderCode: number | null;
  readonly sealedPayload: SealedWebhookPayload | null;
}

export interface RequeueWebhookInput {
  readonly inboxRef: string;
  /** Only a row still in one of these states may be put back. */
  readonly fromStatuses: readonly string[];
  readonly nowMs: number;
  readonly replayedBy: string;
}

export interface ResolveReplayedWebhookInput {
  readonly inboxRef: string;
  readonly nowMs: number;
  readonly replayedBy: string;
  readonly lastError: string | null;
}

export interface IWebhookInboxRepository {
  recordPaymentEvent(input: RecordPaymentEventInput): Promise<PersistedWebhookResult>;
  recordDiagnostic(input: RecordWebhookDiagnosticInput): Promise<PersistedWebhookResult>;
  findRow(inboxRef: string): Promise<WebhookInboxRow | null>;
  /**
   * Puts a stalled row back into the drain's queue, clearing its lease and its
   * spent attempt budget. False when the row left `fromStatuses` first, which
   * is how two operators pressing replay together produce one replay.
   */
  requeue(input: RequeueWebhookInput): Promise<boolean>;
  /**
   * Closes a row a replay resolved outside the queue — an unreadable body the
   * current parser understood, whose payment event has just been recorded.
   */
  resolveReplayed(input: ResolveReplayedWebhookInput): Promise<boolean>;
}
