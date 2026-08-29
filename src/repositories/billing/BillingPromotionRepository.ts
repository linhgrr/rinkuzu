import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { Promotion, PromotionRedemption } from '@/models/Billing';
import type {
  CreatePromotionInput,
  IBillingPromotionRepository,
  PromotionAdminView,
} from '@/interfaces/repositories/IBillingPromotionRepository';
import { BillingDomainError, normalizePromoCode } from '@/services/billing/billing-domain';
import { reconciliationDelayMs, withJitter } from '@/services/billing/domain/schedule';
import type { PromotionPersistenceRecord } from '@/repositories/types/BillingPersistence';
import { releasePromotionReservation } from './promotion-lifecycle';

interface DueReleaseCandidate {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  reservedAt: Date;
  releaseAttemptCount?: number;
}

function promotionAdminView(promotion: PromotionPersistenceRecord): PromotionAdminView {
  return {
    id: promotion._id.toString(),
    code: promotion.code,
    ...(promotion.description !== undefined ? { description: promotion.description } : {}),
    kind: promotion.kind,
    ...(promotion.percentageOff !== undefined ? { percentageOff: promotion.percentageOff } : {}),
    ...(promotion.percentageCap !== undefined ? { percentageCap: promotion.percentageCap } : {}),
    ...(promotion.fixedAmount !== undefined ? { fixedAmount: promotion.fixedAmount } : {}),
    minimumSubtotal: promotion.minimumSubtotal,
    eligibilityClass: promotion.eligibilityClass,
    ...(promotion.totalLimit !== undefined ? { totalLimit: promotion.totalLimit } : {}),
    perUserLimit: promotion.perUserLimit,
    reservedCount: promotion.reservedCount,
    redeemedCount: promotion.redeemedCount,
    overrunCount: promotion.overrunCount,
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    active: promotion.active,
    version: promotion.version,
  };
}

/**
 * Promotions as an administered catalogue, plus the background release of
 * reservations whose order died without money.
 *
 * The release is deliberately its own retried unit rather than part of
 * settlement: one wedged reservation must never be able to fail a settlement
 * that has already banked money.
 */
export class BillingPromotionRepository implements IBillingPromotionRepository {
  async listPromotions(): Promise<PromotionAdminView[]> {
    await connectDB();
    const promotions = await Promotion.find()
      .sort({ createdAt: -1 })
      .lean<PromotionPersistenceRecord[]>()
      .exec();
    return promotions.map(promotionAdminView);
  }

  async createPromotion(input: CreatePromotionInput): Promise<PromotionAdminView> {
    await connectDB();
    const normalizedCode = normalizePromoCode(input.code);
    try {
      const created = await Promotion.create({
        code: normalizedCode,
        normalizedCode,
        ...(input.description !== undefined ? { description: input.description } : {}),
        kind: input.kind,
        ...(input.percentageOff !== undefined ? { percentageOff: input.percentageOff } : {}),
        ...(input.percentageCap !== undefined ? { percentageCap: input.percentageCap } : {}),
        ...(input.fixedAmount !== undefined ? { fixedAmount: input.fixedAmount } : {}),
        currency: input.currency ?? 'VND',
        minimumSubtotal: input.minimumSubtotal,
        eligibilityClass: input.eligibilityClass,
        ...(input.totalLimit !== undefined ? { totalLimit: input.totalLimit } : {}),
        perUserLimit: input.perUserLimit,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      });
      return promotionAdminView(created.toObject<PromotionPersistenceRecord>());
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BillingDomainError('promotion_conflict', 'Promotion code is already used', 409);
      }
      throw error;
    }
  }

  async archivePromotion(id: string): Promise<PromotionAdminView> {
    await connectDB();
    if (!Types.ObjectId.isValid(id)) {
      throw new BillingDomainError('promotion_not_found', 'Promotion not found', 404);
    }
    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, archivedAt: { $exists: false } },
      { $set: { active: false, archivedAt: new Date() }, $inc: { version: 1 } },
      { new: true, runValidators: true },
    )
      .lean<PromotionPersistenceRecord>()
      .exec();
    if (!promotion) {
      throw new BillingDomainError('promotion_not_found', 'Promotion not found', 404);
    }
    return promotionAdminView(promotion);
  }

  /**
   * Releases promo reservations whose order died without money.
   *
   * A reservation that is not yet releasable — the order is still open, or the
   * release threw — is rescheduled rather than dropped, and the backoff grows
   * with the age of the reservation so a permanently stuck one stops consuming
   * the batch.
   */
  async releaseDuePromotionReservations(limit: number): Promise<number> {
    await connectDB();
    const now = new Date();
    const redemptions = await PromotionRedemption.find({
      status: 'reserved',
      $or: [{ nextReleaseCheckAt: { $lte: now } }, { nextReleaseCheckAt: { $exists: false } }],
    })
      .sort({ nextReleaseCheckAt: 1, reservedAt: 1 })
      .limit(limit)
      .select({ order: 1, reservedAt: 1, releaseAttemptCount: 1 })
      .lean<DueReleaseCandidate[]>()
      .exec();
    let released = 0;
    for (const redemption of redemptions) {
      try {
        if (
          await releasePromotionReservation(
            redemption.order,
            'terminal_zero_payment_reconciliation',
          )
        ) {
          released += 1;
          continue;
        }
        await this.rescheduleRelease(redemption._id, redemption.reservedAt);
      } catch (error) {
        await this.rescheduleRelease(redemption._id, redemption.reservedAt, error);
      }
    }
    return released;
  }

  private async rescheduleRelease(
    redemptionId: Types.ObjectId,
    reservedAt: Date,
    error?: unknown,
  ): Promise<void> {
    const delay = withJitter(reconciliationDelayMs(Date.now() - reservedAt.getTime()));
    await PromotionRedemption.updateOne(
      { _id: redemptionId, status: 'reserved' },
      {
        $set: {
          nextReleaseCheckAt: new Date(Date.now() + delay),
          ...(error
            ? {
                lastReleaseError: (error instanceof Error ? error.message : 'Release failed').slice(
                  0,
                  1_000,
                ),
              }
            : {}),
        },
        $inc: { releaseAttemptCount: 1 },
        ...(!error ? { $unset: { lastReleaseError: 1 } } : {}),
      },
    );
  }
}
