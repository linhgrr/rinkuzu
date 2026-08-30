import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { WEBHOOK_VERIFICATION_CLASSES } from '@/services/billing/domain/webhook-diagnostics';
import { ADMIN_ORDER_BUCKETS } from '@/shared/constants/billing-order-buckets';

// This shape deliberately echoes its sibling in the entity and persistence
// layers; see docs/architecture/three-layer-standard.md. Do not derive one
// from another.

export const adminBillingOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  bucket: z.enum(ADMIN_ORDER_BUCKETS).default('attention'),
  // Matches a public order id, a provider order code, or a buyer email.
  search: z.string().trim().max(200).optional(),
});

export const adminBillingOrderRouteParamsSchema = z.strictObject({
  orderId: z.uuid(),
});

export interface AdminBillingOrderRowDto {
  id: string;
  orderCode: number;
  userId: string;
  userEmail: string;
  plan: { id: string; name: string };
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Counts for the queues an operator has to keep at zero. Surfaced alongside
 * the list so the page needs one request, not two.
 */
export interface AdminBillingHealthDto {
  ordersNeedingAttention: number;
  paidButUnfulfilled: number;
  attemptsInReview: number;
  attemptsIndeterminate: number;
  inboxOrphaned: number;
  inboxRetryable: number;
  inboxDeadLettered: number;
  webhooksUnsupportedSchema: number;
  webhooksUnauthenticatedRecent: number;
}

/** One webhook inbox row, named by its persistence id in the route. */
export const adminWebhookRowParamsSchema = z.strictObject({
  inboxId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Webhook id is invalid'),
});

export const adminBillingWebhookListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  verificationClass: z.enum(WEBHOOK_VERIFICATION_CLASSES).optional(),
});

export interface AdminBillingWebhookRowDto {
  id: string;
  provider: string;
  environment: string;
  verificationClass: string;
  rejectionReason?: string;
  status: string;
  orderCode?: number;
  eventCode?: string;
  eventDesc?: string;
  rawPayloadHash: string;
  rawPayloadBytes?: number;
  retainedPayloadStored: boolean;
  retainedPayloadKeyVersion?: string;
  attemptCount: number;
  lastError?: string;
  retainUntil?: string;
  createdAt: string;
}

export interface AdminBillingWebhookListDto {
  webhooks: AdminBillingWebhookRowDto[];
  pagination: PaginationMeta;
}

export interface AdminBillingOrderListDto {
  orders: AdminBillingOrderRowDto[];
  pagination: PaginationMeta;
  health: AdminBillingHealthDto;
}

export interface AdminBillingAttemptDto {
  id: string;
  provider: string;
  environment: string;
  externalOrderId?: string;
  paymentLinkId?: string;
  requestedAmount: number;
  amountPaid: number;
  collectionStatus: string;
  createOutcome: string;
  activeForCheckout: boolean;
  reconcileCount: number;
  lastProviderError?: string;
  expiresAt: string;
  nextReconcileAt: string;
  createdAt: string;
}

export interface AdminBillingTransactionDto {
  id: string;
  transactionType: string;
  externalReference: string;
  signedAmount: number;
  direction: string;
  settlementState: string;
  providerEventAt: string;
}

export interface AdminBillingAdjustmentDto {
  id: string;
  type: string;
  externalReference: string;
  amount: number;
  allocation: string;
  occurredAt: string;
}

export interface AdminBillingEntitlementDto {
  granted: boolean;
  revoked: boolean;
  currentEndAt?: string;
  perpetual: boolean;
}

export interface AdminBillingOrderDetailDto {
  order: AdminBillingOrderRowDto;
  attempts: AdminBillingAttemptDto[];
  transactions: AdminBillingTransactionDto[];
  adjustments: AdminBillingAdjustmentDto[];
  entitlement: AdminBillingEntitlementDto;
}

export type AdminBillingOrderListQueryDto = z.infer<typeof adminBillingOrderListQuerySchema>;
export type AdminBillingWebhookListQueryDto = z.infer<typeof adminBillingWebhookListQuerySchema>;
