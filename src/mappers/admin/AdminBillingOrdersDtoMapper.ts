import type {
  AdminBillingAdjustmentRecord,
  AdminBillingAttemptRecord,
  AdminBillingEntitlementSnapshot,
  AdminBillingHealthSnapshot,
  AdminBillingOrderDetailRecord,
  AdminBillingOrderRecord,
  AdminBillingTransactionRecord,
  AdminBillingWebhookDiagnosticRecord,
} from '@/entities/AdminBillingOrders';
import type {
  AdminBillingAdjustmentDto,
  AdminBillingAttemptDto,
  AdminBillingEntitlementDto,
  AdminBillingHealthDto,
  AdminBillingOrderDetailDto,
  AdminBillingOrderListDto,
  AdminBillingOrderRowDto,
  AdminBillingTransactionDto,
  AdminBillingWebhookListDto,
  AdminBillingWebhookRowDto,
} from '@/dtos/admin-billing-orders';
import type { PaginationMeta } from '@/dtos/common';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

const UNKNOWN_EMAIL = '—';

export class AdminBillingOrdersDtoMapper {
  static toListDto(
    orders: AdminBillingOrderRecord[],
    pagination: PaginationMeta,
    health: AdminBillingHealthSnapshot,
  ): AdminBillingOrderListDto {
    return {
      orders: orders.map(AdminBillingOrdersDtoMapper.toRowDto),
      pagination,
      health: AdminBillingOrdersDtoMapper.toHealthDto(health),
    };
  }

  static toHealthDto(health: AdminBillingHealthSnapshot): AdminBillingHealthDto {
    return {
      ordersNeedingAttention: health.ordersNeedingAttention,
      paidButUnfulfilled: health.paidButUnfulfilled,
      attemptsInReview: health.attemptsInReview,
      attemptsIndeterminate: health.attemptsIndeterminate,
      inboxOrphaned: health.inboxOrphaned,
      inboxRetryable: health.inboxRetryable,
      inboxDeadLettered: health.inboxDeadLettered,
      webhooksUnsupportedSchema: health.webhooksUnsupportedSchema,
      webhooksUnauthenticatedRecent: health.webhooksUnauthenticatedRecent,
    };
  }

  static toWebhookListDto(
    webhooks: AdminBillingWebhookDiagnosticRecord[],
    pagination: PaginationMeta,
  ): AdminBillingWebhookListDto {
    return { webhooks: webhooks.map(AdminBillingOrdersDtoMapper.toWebhookRowDto), pagination };
  }

  static toWebhookRowDto(row: AdminBillingWebhookDiagnosticRecord): AdminBillingWebhookRowDto {
    const retainUntil = serializeOptionalDate(row.retainUntil, 'paymentWebhookInbox.retainUntil');
    return {
      id: row.id,
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
      retainedPayloadStored: row.retainedPayloadStored,
      ...(row.retainedPayloadKeyVersion === undefined
        ? {}
        : { retainedPayloadKeyVersion: row.retainedPayloadKeyVersion }),
      attemptCount: row.attemptCount,
      ...(row.lastError === undefined ? {} : { lastError: row.lastError }),
      ...(retainUntil === undefined ? {} : { retainUntil }),
      createdAt: serializeDate(row.createdAt, 'paymentWebhookInbox.createdAt'),
    };
  }

  static toRowDto(order: AdminBillingOrderRecord): AdminBillingOrderRowDto {
    return {
      id: order.publicId,
      orderCode: order.orderCode,
      userId: order.userId,
      userEmail: order.userEmail ?? UNKNOWN_EMAIL,
      plan: { id: order.planId, name: order.planName },
      currency: order.currency,
      finalAmount: order.finalAmount,
      receivedAmount: order.receivedAmount,
      excessAmount: order.excessAmount,
      excessResolution: order.excessResolution,
      collectionStatus: order.collectionStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      settlementStatus: order.settlementStatus,
      ...(order.attemptCollectionStatus === undefined
        ? {}
        : { attemptCollectionStatus: order.attemptCollectionStatus }),
      ...(order.promotionCode === undefined ? {} : { promotionCode: order.promotionCode }),
      createdAt: serializeDate(order.createdAt, 'billingOrder.createdAt'),
      updatedAt: serializeDate(order.updatedAt, 'billingOrder.updatedAt'),
    };
  }

  static toDetailDto(detail: AdminBillingOrderDetailRecord): AdminBillingOrderDetailDto {
    return {
      order: AdminBillingOrdersDtoMapper.toRowDto(detail.order),
      attempts: detail.attempts.map(AdminBillingOrdersDtoMapper.toAttemptDto),
      transactions: detail.transactions.map(AdminBillingOrdersDtoMapper.toTransactionDto),
      adjustments: detail.adjustments.map(AdminBillingOrdersDtoMapper.toAdjustmentDto),
      entitlement: AdminBillingOrdersDtoMapper.toEntitlementDto(detail.entitlement),
    };
  }

  static toAttemptDto(attempt: AdminBillingAttemptRecord): AdminBillingAttemptDto {
    return {
      id: attempt.id,
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
      expiresAt: serializeDate(attempt.expiresAt, 'paymentAttempt.expiresAt'),
      nextReconcileAt: serializeDate(attempt.nextReconcileAt, 'paymentAttempt.nextReconcileAt'),
      createdAt: serializeDate(attempt.createdAt, 'paymentAttempt.createdAt'),
    };
  }

  static toTransactionDto(transaction: AdminBillingTransactionRecord): AdminBillingTransactionDto {
    return {
      id: transaction.id,
      transactionType: transaction.transactionType,
      externalReference: transaction.externalReference,
      signedAmount: transaction.signedAmount,
      direction: transaction.direction,
      settlementState: transaction.settlementState,
      providerEventAt: serializeDate(
        transaction.providerEventAt,
        'paymentTransaction.providerEventAt',
      ),
    };
  }

  static toAdjustmentDto(adjustment: AdminBillingAdjustmentRecord): AdminBillingAdjustmentDto {
    return {
      id: adjustment.id,
      type: adjustment.type,
      externalReference: adjustment.externalReference,
      amount: adjustment.amount,
      allocation: adjustment.allocation,
      occurredAt: serializeDate(adjustment.occurredAt, 'externalMoneyAdjustment.occurredAt'),
    };
  }

  static toEntitlementDto(
    entitlement: AdminBillingEntitlementSnapshot,
  ): AdminBillingEntitlementDto {
    const currentEndAt = serializeOptionalDate(
      entitlement.currentEndAt,
      'entitlementAccount.currentEndAt',
    );
    return {
      granted: entitlement.granted,
      revoked: entitlement.revoked,
      ...(currentEndAt === undefined ? {} : { currentEndAt }),
      perpetual: entitlement.perpetual,
    };
  }
}
