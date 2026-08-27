import type { Types } from 'mongoose';

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
