/**
 * Promotion administration and the reservation lifecycle that outlives a single
 * checkout. Releasing a reservation lives here rather than on the settlement
 * port because it is promotion bookkeeping with its own due marker and backoff:
 * a reservation that cannot be released must never fail a settlement that has
 * already banked money.
 */

export interface PromotionAdminView {
  id: string;
  code: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  percentageCap?: number;
  fixedAmount?: number;
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  reservedCount: number;
  redeemedCount: number;
  overrunCount: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  version: number;
}

export interface CreatePromotionInput {
  code: string;
  description?: string | undefined;
  kind: 'percentage' | 'fixed';
  percentageOff?: number | undefined;
  percentageCap?: number | undefined;
  fixedAmount?: number | undefined;
  currency?: 'VND' | undefined;
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number | undefined;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
}

export interface IBillingPromotionRepository {
  listPromotions(): Promise<PromotionAdminView[]>;
  createPromotion(input: CreatePromotionInput): Promise<PromotionAdminView>;
  archivePromotion(id: string): Promise<PromotionAdminView>;
  /**
   * Releases promotion reservations whose order can no longer redeem them.
   * Returns how many were released.
   */
  releaseDuePromotionReservations(limit: number): Promise<number>;
}
