import type { Types } from 'mongoose';

// This shape deliberately echoes its sibling in the DTO and entity layers;
// see docs/architecture/three-layer-standard.md. Do not derive one from
// another.
export interface AdminBillingAttemptPersistence {
  _id: Types.ObjectId;
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
  expiresAt: Date;
  nextReconcileAt: Date;
  createdAt: Date;
}

export interface AdminBillingTransactionPersistence {
  _id: Types.ObjectId;
  transactionType: string;
  externalReference: string;
  signedAmount: number;
  direction: string;
  settlementState: string;
  providerEventAt: Date;
}

export interface AdminBillingAdjustmentPersistence {
  _id: Types.ObjectId;
  type: string;
  externalReference: string;
  amount: number;
  allocation: string;
  occurredAt: Date;
}

/**
 * What the diagnostics list is allowed to know about a sealed body.
 *
 * The list renders "a body is retained, sealed under key X" and never the body
 * itself, so the ciphertext has no reason to leave the database on this path.
 * Narrowing the type is half of that; the projection in the repository is the
 * other half, and the two are meant to be read together — a list query that
 * loads the ciphertext is one careless mapper edit away from serialising it.
 */
interface RetainedPayloadMarkerPersistence {
  keyVersion: string;
}

export interface AdminBillingWebhookPersistence {
  _id: Types.ObjectId;
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
  encryptedRawPayload?: RetainedPayloadMarkerPersistence;
  attemptCount: number;
  lastError?: string;
  retainUntil?: Date;
  createdAt: Date;
}
