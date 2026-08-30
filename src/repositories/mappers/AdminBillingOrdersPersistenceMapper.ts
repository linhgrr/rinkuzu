// This mapper's persistence shape deliberately echoes its sibling in
// AdminBillingOrdersDtoMapper; see docs/architecture/three-layer-standard.md.
// Do not derive one from another.
import type { Types } from 'mongoose';
import type {
  AdminBillingAdjustmentRecord,
  AdminBillingAttemptRecord,
  AdminBillingOrderRecord,
  AdminBillingTransactionRecord,
  AdminBillingWebhookDiagnosticRecord,
} from '@/entities/AdminBillingOrders';
import type {
  AdminBillingAdjustmentPersistence,
  AdminBillingAttemptPersistence,
  AdminBillingTransactionPersistence,
  AdminBillingWebhookPersistence,
} from '@/repositories/types/AdminBillingOrdersPersistence';

export interface AdminBillingOrderPersistenceRow {
  publicId: string;
  orderCode: number;
  user: Types.ObjectId;
  userEmail?: string;
  planId: string;
  planName: string;
  currency: string;
  finalAmount: number;
  receivedAmount: number;
  excessAmount: number;
  excessResolution: string;
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  attemptCollectionStatus?: string;
  promotionCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminBillingOrdersPersistenceMapper {
  static toOrder(row: AdminBillingOrderPersistenceRow): AdminBillingOrderRecord {
    return {
      publicId: row.publicId,
      orderCode: row.orderCode,
      userId: row.user.toString(),
      ...(row.userEmail === undefined ? {} : { userEmail: row.userEmail }),
      planId: row.planId,
      planName: row.planName,
      currency: row.currency,
      finalAmount: row.finalAmount,
      receivedAmount: row.receivedAmount,
      excessAmount: row.excessAmount,
      excessResolution: row.excessResolution,
      collectionStatus: row.collectionStatus,
      fulfillmentStatus: row.fulfillmentStatus,
      settlementStatus: row.settlementStatus,
      ...(row.attemptCollectionStatus === undefined
        ? {}
        : { attemptCollectionStatus: row.attemptCollectionStatus }),
      ...(row.promotionCode === undefined ? {} : { promotionCode: row.promotionCode }),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static toAttempt(attempt: AdminBillingAttemptPersistence): AdminBillingAttemptRecord {
    return {
      id: attempt._id.toString(),
      provider: attempt.provider,
      environment: attempt.environment,
      ...(attempt.externalOrderId === undefined
        ? {}
        : { externalOrderId: attempt.externalOrderId }),
      ...(attempt.paymentLinkId === undefined ? {} : { paymentLinkId: attempt.paymentLinkId }),
      requestedAmount: attempt.requestedAmount,
      amountPaid: attempt.amountPaid,
      collectionStatus: attempt.collectionStatus,
      createOutcome: attempt.createOutcome,
      activeForCheckout: attempt.activeForCheckout,
      reconcileCount: attempt.reconcileCount,
      ...(attempt.lastProviderError === undefined
        ? {}
        : { lastProviderError: attempt.lastProviderError }),
      expiresAt: attempt.expiresAt,
      nextReconcileAt: attempt.nextReconcileAt,
      createdAt: attempt.createdAt,
    };
  }

  static toTransaction(
    transaction: AdminBillingTransactionPersistence,
  ): AdminBillingTransactionRecord {
    return {
      id: transaction._id.toString(),
      transactionType: transaction.transactionType,
      externalReference: transaction.externalReference,
      signedAmount: transaction.signedAmount,
      direction: transaction.direction,
      settlementState: transaction.settlementState,
      providerEventAt: transaction.providerEventAt,
    };
  }

  /**
   * A listing says whether a body is retained and under which key version. It
   * never opens one.
   *
   * The retained body is provider text that may name a payer, kept only so a
   * parser failure can be explained. Decrypting every one of them on the way
   * past made a routine page load a bulk disclosure and left "who has seen
   * this?" unanswerable; opening one is a separate, audited action against a
   * single row.
   */
  static toWebhookDiagnostic(
    row: AdminBillingWebhookPersistence,
  ): AdminBillingWebhookDiagnosticRecord {
    const sealed = row.encryptedRawPayload;
    return {
      id: row._id.toString(),
      provider: row.provider,
      environment: row.environment,
      verificationClass: row.verificationClass,
      ...(row.rejectionReason === undefined ? {} : { rejectionReason: row.rejectionReason }),
      status: row.status,
      ...(row.orderCode === undefined ? {} : { orderCode: row.orderCode }),
      ...(row.eventCode === undefined ? {} : { eventCode: row.eventCode }),
      ...(row.eventDesc === undefined ? {} : { eventDesc: row.eventDesc }),
      rawPayloadHash: row.rawPayloadHash,
      ...(row.rawPayloadBytes === undefined ? {} : { rawPayloadBytes: row.rawPayloadBytes }),
      retainedPayloadStored: sealed !== undefined,
      ...(sealed === undefined ? {} : { retainedPayloadKeyVersion: sealed.keyVersion }),
      attemptCount: row.attemptCount,
      ...(row.lastError === undefined ? {} : { lastError: row.lastError }),
      ...(row.retainUntil === undefined ? {} : { retainUntil: row.retainUntil }),
      createdAt: row.createdAt,
    };
  }

  static toAdjustment(adjustment: AdminBillingAdjustmentPersistence): AdminBillingAdjustmentRecord {
    return {
      id: adjustment._id.toString(),
      type: adjustment.type,
      externalReference: adjustment.externalReference,
      amount: adjustment.amount,
      allocation: adjustment.allocation,
      occurredAt: adjustment.occurredAt,
    };
  }
}
