import type {
  AdminBillingAdjustmentDto,
  AdminBillingAttemptDto,
  AdminBillingEntitlementDto,
  AdminBillingOrderDetailDto,
  AdminBillingOrderListDto,
  AdminBillingOrderRowDto,
  AdminBillingTransactionDto,
  AdminBillingWebhookListDto,
  AdminBillingWebhookRowDto,
} from '@/dtos/admin-billing-orders';
import { formatDateTime, formatVndCurrency } from '@/lib/formatters';
import type {
  AdminBillingAdjustmentViewModel,
  AdminBillingAttemptViewModel,
  AdminBillingEntitlementViewModel,
  AdminBillingOrderDetailViewModel,
  AdminBillingOrderListViewModel,
  AdminBillingOrderRowViewModel,
  AdminBillingTransactionViewModel,
  AdminWebhookDiagnosticListViewModel,
  AdminWebhookDiagnosticViewModel,
} from '@/features/admin/billing/types/admin-billing-view-model';

const EMPTY = '—';

function dateLabel(value: string | undefined): string {
  return value ? formatDateTime(value, { emptyLabel: EMPTY }) : EMPTY;
}

function toAdminBillingOrderRowViewModel(
  order: AdminBillingOrderRowDto,
): AdminBillingOrderRowViewModel {
  return {
    id: order.id,
    orderCode: String(order.orderCode),
    userId: order.userId,
    userEmail: order.userEmail,
    planName: order.plan.name,
    finalAmountLabel: formatVndCurrency(order.finalAmount),
    receivedAmountLabel: formatVndCurrency(order.receivedAmount),
    // Anything other than exactly-paid needs a human to look at the money.
    moneyMismatch: order.receivedAmount !== order.finalAmount,
    ...(order.excessAmount > 0 ? { excessAmountLabel: formatVndCurrency(order.excessAmount) } : {}),
    collectionStatus: order.collectionStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    settlementStatus: order.settlementStatus,
    attemptCollectionStatus: order.attemptCollectionStatus ?? EMPTY,
    excessResolution: order.excessResolution,
    excessResolvable: order.excessResolution === 'unallocated',
    ...(order.promotionCode === undefined ? {} : { promotionCode: order.promotionCode }),
    createdAtLabel: dateLabel(order.createdAt),
    updatedAtLabel: dateLabel(order.updatedAt),
  };
}

export function toAdminBillingOrderListViewModel(
  dto: AdminBillingOrderListDto,
): AdminBillingOrderListViewModel {
  return {
    orders: dto.orders.map(toAdminBillingOrderRowViewModel),
    pagination: {
      page: dto.pagination.currentPage,
      limit: dto.pagination.itemsPerPage,
      total: dto.pagination.totalItems,
      totalPages: dto.pagination.totalPages,
    },
    health: dto.health,
  };
}

function toAttemptViewModel(attempt: AdminBillingAttemptDto): AdminBillingAttemptViewModel {
  return {
    id: attempt.id,
    label: attempt.externalOrderId ?? attempt.paymentLinkId ?? attempt.id,
    collectionStatus: attempt.collectionStatus,
    createOutcome: attempt.createOutcome,
    amountPaidLabel: formatVndCurrency(attempt.amountPaid),
    activeForCheckout: attempt.activeForCheckout,
    reconcileCount: attempt.reconcileCount,
    ...(attempt.lastProviderError === undefined
      ? {}
      : { lastProviderError: attempt.lastProviderError }),
    expiresAtLabel: dateLabel(attempt.expiresAt),
    nextReconcileAtLabel: dateLabel(attempt.nextReconcileAt),
    createdAtLabel: dateLabel(attempt.createdAt),
  };
}

function toTransactionViewModel(
  transaction: AdminBillingTransactionDto,
): AdminBillingTransactionViewModel {
  return {
    id: transaction.id,
    transactionType: transaction.transactionType,
    externalReference: transaction.externalReference,
    amountLabel: formatVndCurrency(transaction.signedAmount),
    direction: transaction.direction,
    settlementState: transaction.settlementState,
    providerEventAtLabel: dateLabel(transaction.providerEventAt),
  };
}

function toAdjustmentViewModel(
  adjustment: AdminBillingAdjustmentDto,
): AdminBillingAdjustmentViewModel {
  return {
    id: adjustment.id,
    type: adjustment.type,
    externalReference: adjustment.externalReference,
    amountLabel: formatVndCurrency(adjustment.amount),
    allocation: adjustment.allocation,
    occurredAtLabel: dateLabel(adjustment.occurredAt),
  };
}

function toEntitlementViewModel(
  entitlement: AdminBillingEntitlementDto,
): AdminBillingEntitlementViewModel {
  const summary = !entitlement.granted
    ? 'No entitlement grant exists for this order'
    : entitlement.revoked
      ? 'Grant was revoked'
      : entitlement.perpetual
        ? 'Granted — perpetual'
        : `Granted — account access until ${dateLabel(entitlement.currentEndAt)}`;
  return { summary, granted: entitlement.granted, revoked: entitlement.revoked };
}

/** The statuses a replay is a meaningful action on; anything else is done. */
const REPLAYABLE_WEBHOOK_STATUSES = [
  'retryable_failure',
  'dead_letter',
  'orphaned',
  'permanent_failure',
];

function toWebhookDiagnosticViewModel(
  row: AdminBillingWebhookRowDto,
): AdminWebhookDiagnosticViewModel {
  return {
    id: row.id,
    verificationClass: row.verificationClass,
    status: row.status,
    ...(row.rejectionReason === undefined ? {} : { rejectionReason: row.rejectionReason }),
    ...(row.orderCode === undefined ? {} : { orderCode: String(row.orderCode) }),
    ...(row.eventCode === undefined ? {} : { eventCode: row.eventCode }),
    ...(row.eventDesc === undefined ? {} : { eventDesc: row.eventDesc }),
    // The hash is a correlation handle an operator reads out loud, not a value
    // to compare by eye; the first twelve characters are enough to match a row
    // against a provider dashboard entry.
    payloadHashShort: row.rawPayloadHash.slice(0, 12),
    sizeLabel: row.rawPayloadBytes === undefined ? EMPTY : `${row.rawPayloadBytes} B`,
    retainedPayloadStored: row.retainedPayloadStored,
    ...(row.retainedPayloadKeyVersion === undefined
      ? {}
      : { retainedPayloadKeyVersion: row.retainedPayloadKeyVersion }),
    attemptCount: row.attemptCount,
    ...(row.lastError === undefined ? {} : { lastError: row.lastError }),
    createdAtLabel: dateLabel(row.createdAt),
    replayable: REPLAYABLE_WEBHOOK_STATUSES.includes(row.status),
  };
}

export function toAdminWebhookDiagnosticListViewModel(
  dto: AdminBillingWebhookListDto,
): AdminWebhookDiagnosticListViewModel {
  return {
    webhooks: dto.webhooks.map(toWebhookDiagnosticViewModel),
    pagination: {
      page: dto.pagination.currentPage,
      limit: dto.pagination.itemsPerPage,
      total: dto.pagination.totalItems,
      totalPages: dto.pagination.totalPages,
    },
  };
}

export function toAdminBillingOrderDetailViewModel(
  dto: AdminBillingOrderDetailDto,
): AdminBillingOrderDetailViewModel {
  return {
    order: toAdminBillingOrderRowViewModel(dto.order),
    attempts: dto.attempts.map(toAttemptViewModel),
    transactions: dto.transactions.map(toTransactionViewModel),
    adjustments: dto.adjustments.map(toAdjustmentViewModel),
    entitlement: toEntitlementViewModel(dto.entitlement),
  };
}
