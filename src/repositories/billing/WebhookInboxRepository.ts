import crypto from 'crypto';
import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { PaymentWebhookInbox } from '@/models/Billing';
import type {
  IWebhookInboxRepository,
  PersistedWebhookResult,
  RecordPaymentEventInput,
  RecordWebhookDiagnosticInput,
  RequeueWebhookInput,
  ResolveReplayedWebhookInput,
  WebhookInboxRow,
} from '@/interfaces/repositories/IWebhookInboxRepository';
import { billingConfig } from '@/services/billing/billing-config';
import {
  WEBHOOK_VERIFICATION_CLASSES,
  webhookRetainUntilMs,
  webhookRetentionPolicy,
} from '@/services/billing/domain/webhook-diagnostics';
import { sealWebhookPayload } from '@/services/billing/domain/webhook-payload-cipher';
import { assertStoredEnum } from './billing-shared';
import type { WebhookInboxOperationPersistenceRecord } from '@/repositories/types/BillingPersistence';

interface WebhookNamespace {
  provider: string;
  providerAccountId: string;
  environment: string;
}

interface StoredNormalizedPayload {
  amount?: number;
  currency?: string;
}

interface ExistingPaymentEventRecord {
  _id: Types.ObjectId;
  rawPayloadHash: string;
  orderCode?: number;
  paymentLinkId?: string;
  normalizedPayload?: StoredNormalizedPayload;
}

interface PayerSignalInput {
  bankId?: string | null;
  accountNumber?: string | null;
}

interface PayerSignalHash {
  hash: string;
  keyVersion: string;
  normalizedVersion: number;
}

function namespace(): WebhookNamespace {
  return {
    provider: 'payos',
    providerAccountId: billingConfig.providerAccountId(),
    environment: billingConfig.providerEnvironment(),
  };
}

/**
 * A keyed hash of the paying account, for spotting one card farming many
 * accounts. The account number itself is never stored, and a missing or short
 * secret produces no signal at all rather than a guessable digest.
 */
function hashPayerSignal(input: PayerSignalInput): PayerSignalHash | null {
  const secret = process.env['ABUSE_SIGNAL_HASH_SECRET'];
  const keyVersion = process.env['ABUSE_SIGNAL_HASH_KEY_VERSION'] ?? 'v1';
  const bank = input.bankId?.trim();
  const account = input.accountNumber?.replace(/[\s-]/g, '');
  if (!secret || secret.length < 32 || !bank || !account || !/^\d{4,30}$/.test(account)) {
    return null;
  }
  return {
    hash: crypto.createHmac('sha256', secret).update(`${bank}:${account}`).digest('hex'),
    keyVersion,
    normalizedVersion: 1,
  };
}

/**
 * The dedup key each verification class is filed under.
 *
 * A payment is keyed by the provider's transaction reference, which is the only
 * identifier that survives redelivery. Everything else is keyed by the hash of
 * the body, so a redelivered diagnostic collapses onto the row that already
 * exists instead of counting twice.
 */
function dedupKeyFor(input: RecordWebhookDiagnosticInput): string {
  switch (input.verificationClass) {
    case 'accepted':
    case 'ignored':
      return `event:${input.facts.rawPayloadHash}`;
    case 'unsupported_schema':
      return `unsupported:${input.facts.rawPayloadHash}`;
    case 'unauthenticated':
      return `rejected:${input.facts.rawPayloadHash}`;
  }
}

/**
 * The queue status a diagnostic lands in.
 *
 * An authenticated notice that names an order is filed as `verified` even
 * though we take no direct action on it: the notice is a signal that the order
 * moved, and the provider's API — not the notice body — is the authority on
 * what it moved to, so it becomes an ordinary reconciliation trigger.
 */
function statusFor(input: RecordWebhookDiagnosticInput): string {
  switch (input.verificationClass) {
    case 'accepted':
    case 'ignored':
      return input.orderCode === null ? 'ignored' : 'verified';
    case 'unsupported_schema':
      return 'permanent_failure';
    case 'unauthenticated':
      return 'rejected';
  }
}

function lastErrorFor(input: RecordWebhookDiagnosticInput): string | null {
  if (input.verificationClass === 'unsupported_schema') {
    return 'Verified webhook schema is unsupported';
  }
  return input.rejectionReason === null ? null : `Rejected: ${input.rejectionReason}`;
}

/**
 * The webhook inbox: one row for every request the endpoint ever accepted or
 * turned away.
 *
 * Persisting the rejections is the point. A silently dropped webhook is
 * indistinguishable from one that never arrived, which is exactly the state an
 * operator is in when a checksum key has been rotated on one side only — the
 * money stops moving and nothing anywhere says why.
 */
export class WebhookInboxRepository implements IWebhookInboxRepository {
  async recordPaymentEvent(input: RecordPaymentEventInput): Promise<PersistedWebhookResult> {
    await connectDB();
    const scope = namespace();
    const dedupKey = `payment:${input.reference}`;
    const payerSignal = hashPayerSignal({
      bankId: input.counterAccountBankId ?? null,
      accountNumber: input.counterAccountNumber ?? null,
    });
    try {
      const created = await PaymentWebhookInbox.create({
        ...scope,
        dedupKey,
        orderCode: input.orderCode,
        paymentLinkId: input.paymentLinkId,
        transactionReference: input.reference,
        normalizedPayload: {
          orderCode: input.orderCode,
          amount: input.amount,
          currency: input.currency,
          paymentLinkId: input.paymentLinkId,
          reference: input.reference,
          transactionDateTime: input.transactionDateTime,
          payerSignal: payerSignal?.hash ?? null,
          payerSignalKeyVersion: payerSignal?.keyVersion ?? null,
          payerSignalNormalizedVersion: payerSignal?.normalizedVersion ?? null,
        },
        rawPayloadHash: input.facts.rawPayloadHash,
        rawPayloadBytes: input.facts.byteSizeBytes,
        ...(input.facts.sourceIpHash ? { sourceIpHash: input.facts.sourceIpHash } : {}),
        verificationClass: 'accepted',
        status: 'verified',
      });
      return { duplicate: false, inboxId: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return this.reconcileDuplicatePaymentEvent(scope, dedupKey, input, error);
    }
  }

  /**
   * A redelivery of a reference we already hold is expected and harmless — but
   * the *same* reference carrying different money is not. That is either a
   * provider bug or a forged replay of a real event, and it must stop rather
   * than quietly resolve to whichever copy arrived first.
   */
  private async reconcileDuplicatePaymentEvent(
    scope: WebhookNamespace,
    dedupKey: string,
    input: RecordPaymentEventInput,
    error: unknown,
  ): Promise<PersistedWebhookResult> {
    const existing = await PaymentWebhookInbox.findOne({ ...scope, dedupKey })
      .select({ _id: 1, rawPayloadHash: 1, orderCode: 1, paymentLinkId: 1, normalizedPayload: 1 })
      .lean<ExistingPaymentEventRecord>()
      .exec();
    if (!existing) throw error;
    const matches =
      existing.rawPayloadHash === input.facts.rawPayloadHash &&
      existing.orderCode === input.orderCode &&
      existing.paymentLinkId === input.paymentLinkId &&
      existing.normalizedPayload?.amount === input.amount &&
      existing.normalizedPayload?.currency === input.currency;
    if (!matches) {
      await PaymentWebhookInbox.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: 'permanent_failure',
            lastError: 'Duplicate payment reference with mismatched payload',
          },
        },
      );
    }
    return { duplicate: true, inboxId: existing._id.toString() };
  }

  async recordDiagnostic(input: RecordWebhookDiagnosticInput): Promise<PersistedWebhookResult> {
    await connectDB();
    const scope = namespace();
    const dedupKey = dedupKeyFor(input);
    const policy = webhookRetentionPolicy({
      verificationClass: input.verificationClass,
      unsupportedRetentionDays: billingConfig.webhookUnsupportedRetentionDays(),
    });
    const retainUntilMs = webhookRetainUntilMs(Date.now(), policy);
    const sealed =
      policy.retainRawBody === 'encrypted' && input.rawBody !== null
        ? sealWebhookPayload(input.rawBody, billingConfig.webhookPayloadKeys())
        : null;
    const lastError = lastErrorFor(input);
    try {
      const created = await PaymentWebhookInbox.create({
        ...scope,
        dedupKey,
        ...(input.orderCode === null ? {} : { orderCode: input.orderCode }),
        rawPayloadHash: input.facts.rawPayloadHash,
        rawPayloadBytes: input.facts.byteSizeBytes,
        ...(input.facts.sourceIpHash ? { sourceIpHash: input.facts.sourceIpHash } : {}),
        verificationClass: input.verificationClass,
        ...(input.rejectionReason === null ? {} : { rejectionReason: input.rejectionReason }),
        ...(input.eventCode === null ? {} : { eventCode: input.eventCode }),
        ...(input.eventDesc === null ? {} : { eventDesc: input.eventDesc }),
        ...(sealed ? { encryptedRawPayload: sealed } : {}),
        ...(retainUntilMs === null ? {} : { retainUntil: new Date(retainUntilMs) }),
        status: statusFor(input),
        ...(lastError === null ? {} : { lastError }),
      });
      return { duplicate: false, inboxId: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await PaymentWebhookInbox.findOne({ ...scope, dedupKey })
        .select({ _id: 1 })
        .lean<{ _id: Types.ObjectId }>()
        .exec();
      if (!existing) throw error;
      return { duplicate: true, inboxId: existing._id.toString() };
    }
  }

  async findRow(inboxRef: string): Promise<WebhookInboxRow | null> {
    await connectDB();
    if (!Types.ObjectId.isValid(inboxRef)) return null;
    const row = await PaymentWebhookInbox.findById(new Types.ObjectId(inboxRef))
      .select({ status: 1, verificationClass: 1, orderCode: 1, encryptedRawPayload: 1 })
      .lean<WebhookInboxOperationPersistenceRecord>()
      .exec();
    if (!row) return null;
    return {
      inboxRef: row._id.toString(),
      status: row.status,
      verificationClass: assertStoredEnum(
        WEBHOOK_VERIFICATION_CLASSES,
        row.verificationClass,
        'webhook verification class',
      ),
      orderCode: row.orderCode ?? null,
      // Handed over still sealed. Opening it is the reveal endpoint's audited
      // decision, not something a read quietly does on the way past.
      sealedPayload: row.encryptedRawPayload ?? null,
    };
  }

  async requeue(input: RequeueWebhookInput): Promise<boolean> {
    await connectDB();
    const result = await PaymentWebhookInbox.updateOne(
      { _id: new Types.ObjectId(input.inboxRef), status: { $in: input.fromStatuses } },
      {
        $set: {
          status: 'verified',
          nextAttemptAt: new Date(input.nowMs),
          // The budget that dead-lettered it is spent; an operator replaying it
          // is saying the cause is fixed, so the row gets a fresh one.
          attemptCount: 0,
          replayedAt: new Date(input.nowMs),
          replayedBy: new Types.ObjectId(input.replayedBy),
        },
        // Any lease still on the row belongs to a worker that has long since
        // gone; clearing it is what makes the row claimable again.
        $unset: { leaseUntil: 1, leaseToken: 1 },
      },
    );
    return result.matchedCount === 1;
  }

  async resolveReplayed(input: ResolveReplayedWebhookInput): Promise<boolean> {
    await connectDB();
    const result = await PaymentWebhookInbox.updateOne(
      { _id: new Types.ObjectId(input.inboxRef), status: { $ne: 'processed' } },
      {
        $set: {
          status: 'processed',
          processedAt: new Date(input.nowMs),
          replayedAt: new Date(input.nowMs),
          replayedBy: new Types.ObjectId(input.replayedBy),
          ...(input.lastError === null ? {} : { lastError: input.lastError }),
        },
        $unset: { leaseUntil: 1, leaseToken: 1 },
      },
    );
    return result.matchedCount === 1;
  }
}
