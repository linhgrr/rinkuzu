import crypto from 'node:crypto';
import mongoose, { type ClientSession, Types } from 'mongoose';
import { EntitlementAccount, EntitlementAdjustment, EntitlementGrant } from '@/models/Billing';
import {
  addCalendarMonths,
  BillingDomainError,
  replayEntitlement,
  type EntitlementProjection,
} from '@/services/billing/billing-domain';
import connectDB from '@/lib/mongoose';
import type { IEntitlementAdminRepository } from '@/interfaces/repositories/IEntitlementAdminRepository';

export interface AppendEntitlementGrantInput {
  user: Types.ObjectId;
  sourceType: 'billing_order' | 'manual' | 'migration';
  sourceId: string;
  planId: string;
  planName: string;
  durationUnit: 'day' | 'month' | 'perpetual';
  durationValue?: number;
  committedAt: Date;
  providerPaidAt?: Date;
}

export interface EntitlementGrantAdjustmentInput {
  user: Types.ObjectId;
  sourceType: 'billing_order' | 'manual' | 'migration';
  sourceId: string;
  adjustmentSourceType: 'refund' | 'chargeback' | 'reversal' | 'admin';
  /** Must be unique per adjustment: the ledger dedupes on source identity. */
  adjustmentSourceId: string;
  reason?: string;
}

/** The two directions an entitlement adjustment can move a grant. */
type EntitlementAdjustmentKind = 'revoke' | 'restore';

/** The label a replayed projection carries when the account row has no plan. */
interface FallbackPlanLabel {
  planId: string;
  planName: string;
}

/**
 * The plan an account falls back to when the projection is replayed and the
 * account row carries no plan of its own — only reachable for an account that
 * predates plan tracking, and only as a label.
 */
const ADJUSTMENT_FALLBACK_PLAN: Record<EntitlementAdjustmentKind, FallbackPlanLabel> = {
  revoke: { planId: 'revoked', planName: 'Revoked' },
  restore: { planId: 'restored', planName: 'Restored' },
};

interface GrantLean {
  _id: Types.ObjectId;
  sequence: number;
  segmentId: string;
  segmentBaselineStartAt: Date;
  segmentAnchorDay: number;
  durationUnit: 'day' | 'month' | 'perpetual';
  durationValue?: number;
}

interface AdjustmentLean {
  sequence: number;
  grant: Types.ObjectId;
  type: 'revoke' | 'restore';
}

function projectionChecksum(projection: EntitlementProjection): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        startAt: projection.startAt?.toISOString() ?? null,
        endAt: projection.endAt?.toISOString() ?? null,
        perpetual: projection.perpetual,
      }),
    )
    .digest('hex');
}

export class EntitlementLedgerRepository implements IEntitlementAdminRepository {
  async revokeAccount(accountId: string, sourceId: string, reason: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    const session = await mongoose.startSession();
    try {
      // Return the callback's result: withTransaction retries on a transient
      // error, and a captured outer variable keeps the losing attempt's value.
      return await session.withTransaction(async () => {
        const account = await EntitlementAccount.findById(accountId)
          .session(session)
          .lean<{ user: Types.ObjectId; planId?: string; planName?: string }>()
          .exec();
        if (!account) return null;

        const grants = await EntitlementGrant.find({ user: account.user })
          .sort({ sequence: 1 })
          .session(session)
          .lean<Array<{ _id: Types.ObjectId }>>()
          .exec();
        const adjustments = await EntitlementAdjustment.find({ user: account.user })
          .sort({ sequence: 1 })
          .session(session)
          .lean<Array<{ grant: Types.ObjectId; type: 'revoke' | 'restore' }>>()
          .exec();
        const effective = new Map(grants.map((grant) => [grant._id.toString(), true]));
        for (const adjustment of adjustments) {
          effective.set(adjustment.grant.toString(), adjustment.type === 'restore');
        }

        for (const grant of grants) {
          if (effective.get(grant._id.toString()) !== true) continue;
          const sequenced = await EntitlementAccount.findOneAndUpdate(
            { _id: new Types.ObjectId(accountId), user: account.user },
            { $inc: { version: 1, nextSequence: 1 } },
            { new: true, session },
          )
            .lean<{ nextSequence: number }>()
            .exec();
          if (!sequenced) throw new Error('Entitlement account disappeared');
          await EntitlementAdjustment.create(
            [
              {
                user: account.user,
                grant: grant._id,
                sequence: sequenced.nextSequence - 1,
                type: 'revoke',
                sourceType: 'admin',
                sourceId: `${sourceId}:${grant._id.toString()}`,
                reason,
                committedAt: new Date(),
              },
            ],
            { session },
          );
        }

        await this.rebuildProjection(
          account.user,
          account.planId ?? 'revoked',
          account.planName ?? 'Revoked',
          session,
        );

        return account.user.toString();
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Appends one revoke or restore against the grant a single source produced.
   *
   * Both directions are the same procedure — find the grant, check the state it
   * is already in, take a sequence number, append, replay the projection — and
   * they were written out twice. Two copies of an entitlement mutation is the
   * worst place for a divergence to hide: it would take one bad edit for a
   * revoke to stop bumping the version a restore reads.
   *
   * Returns the affected user id when an adjustment was appended, so the caller
   * can invalidate exactly that user's tier cache, or null when there was
   * nothing to do.
   */
  private async appendGrantAdjustment(
    input: EntitlementGrantAdjustmentInput,
    session: ClientSession,
    kind: EntitlementAdjustmentKind,
  ): Promise<string | null> {
    const grant = await EntitlementGrant.findOne({
      user: input.user,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })
      .session(session)
      .lean<{ _id: Types.ObjectId }>()
      .exec();
    if (!grant) return null;

    const latest = await EntitlementAdjustment.findOne({ user: input.user, grant: grant._id })
      .sort({ sequence: -1 })
      .session(session)
      .lean<{ type: EntitlementAdjustmentKind }>()
      .exec();
    // A grant nobody has adjusted is already in the restored state, so the
    // ledger is a toggle: an adjustment that would not change it is a no-op,
    // not a second row. That is what makes a replayed reversal idempotent.
    const current: EntitlementAdjustmentKind = latest?.type ?? 'restore';
    if (current === kind) return null;

    const sequenced = await EntitlementAccount.findOneAndUpdate(
      { user: input.user },
      { $inc: { version: 1, nextSequence: 1 } },
      { new: true, session },
    )
      .lean<{ nextSequence: number; planId?: string; planName?: string }>()
      .exec();
    if (!sequenced) throw new Error('Entitlement account disappeared');

    await EntitlementAdjustment.create(
      [
        {
          user: input.user,
          grant: grant._id,
          sequence: sequenced.nextSequence - 1,
          type: kind,
          sourceType: input.adjustmentSourceType,
          sourceId: input.adjustmentSourceId,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          committedAt: new Date(),
        },
      ],
      { session },
    );

    const fallback = ADJUSTMENT_FALLBACK_PLAN[kind];
    await this.rebuildProjection(
      input.user,
      sequenced.planId ?? fallback.planId,
      sequenced.planName ?? fallback.planName,
      session,
    );
    return input.user.toString();
  }

  /**
   * Revoke exactly the grant a single source produced — the refund/chargeback
   * counterpart to `appendGrant`. Unlike `revokeAccount` this leaves every
   * other grant standing, so clawing back one order cannot delete a renewal
   * the customer paid for separately.
   */
  revokeGrantBySource(
    input: EntitlementGrantAdjustmentInput,
    session: ClientSession,
  ): Promise<string | null> {
    return this.appendGrantAdjustment(input, session, 'revoke');
  }

  /**
   * Puts back the grant a revocation took away, when the money came back.
   *
   * A chargeback that is later reversed, or a refund that is itself refunded,
   * leaves the order paid for again — and under the old type-switch rule the
   * customer stayed revoked forever, because nothing in the system could undo a
   * revocation. Restoration is an append like any other: the revoke stays in
   * the ledger and the projection is replayed over both.
   */
  restoreGrantBySource(
    input: EntitlementGrantAdjustmentInput,
    session: ClientSession,
  ): Promise<string | null> {
    return this.appendGrantAdjustment(input, session, 'restore');
  }

  async appendGrant(
    input: AppendEntitlementGrantInput,
    session: ClientSession,
  ): Promise<EntitlementProjection> {
    const existing = await EntitlementGrant.findOne({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })
      .session(session)
      .lean<{ user: Types.ObjectId }>()
      .exec();
    if (existing && !existing.user.equals(input.user)) {
      throw new BillingDomainError(
        'entitlement_source_conflict',
        'Entitlement source belongs to another account',
        409,
      );
    }

    if (!existing) {
      // Seed and sequence in two steps: MongoDB rejects an update that touches
      // the same path from both `$setOnInsert` and `$inc` (ConflictingUpdate-
      // Operators, code 40), and `$inc` alone on insert would allocate
      // sequence 0, which `EntitlementGrant.sequence` (min: 1) refuses.
      await EntitlementAccount.updateOne(
        { user: input.user },
        {
          $setOnInsert: {
            user: input.user,
            version: 0,
            nextSequence: 1,
            perpetual: false,
            lastCheckpointSequence: 0,
          },
        },
        { upsert: true, session },
      );
      const account = await EntitlementAccount.findOneAndUpdate(
        { user: input.user },
        { $inc: { version: 1, nextSequence: 1 } },
        { new: true, session },
      )
        .lean<{ nextSequence: number; currentEndAt?: Date; perpetual: boolean }>()
        .exec();
      if (!account) throw new Error('Entitlement account disappeared');
      if (account.perpetual) {
        throw new BillingDomainError(
          'already_has_perpetual_entitlement',
          'This account already has perpetual Premium',
          409,
        );
      }

      const active =
        account.currentEndAt !== undefined &&
        account.currentEndAt.getTime() > input.committedAt.getTime();
      const lastGrant = active
        ? await EntitlementGrant.findOne({ user: input.user })
            .sort({ sequence: -1 })
            .session(session)
            .lean<Pick<GrantLean, 'segmentId' | 'segmentBaselineStartAt' | 'segmentAnchorDay'>>()
            .exec()
        : null;
      const baseline = active && account.currentEndAt ? account.currentEndAt : input.committedAt;
      const segmentId = lastGrant?.segmentId ?? crypto.randomUUID();
      const segmentBaseline = lastGrant?.segmentBaselineStartAt ?? baseline;
      const anchorDay = lastGrant?.segmentAnchorDay ?? baseline.getUTCDate();
      const projectionEnd =
        input.durationUnit === 'perpetual'
          ? undefined
          : input.durationUnit === 'month'
            ? addCalendarMonths(baseline, input.durationValue ?? 0, anchorDay)
            : new Date(baseline.getTime() + (input.durationValue ?? 0) * 86_400_000);

      await EntitlementGrant.create(
        [
          {
            user: input.user,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            sequence: account.nextSequence - 1,
            segmentId,
            planId: input.planId,
            planName: input.planName,
            durationUnit: input.durationUnit,
            ...(input.durationValue === undefined ? {} : { durationValue: input.durationValue }),
            segmentBaselineStartAt: segmentBaseline,
            segmentAnchorDay: anchorDay,
            committedAt: input.committedAt,
            ...(input.providerPaidAt === undefined ? {} : { providerPaidAt: input.providerPaidAt }),
            originalEffectiveStartAt: baseline,
            ...(projectionEnd === undefined ? {} : { originalEffectiveEndAt: projectionEnd }),
          },
        ],
        { session },
      );
    }

    return this.rebuildProjection(input.user, input.planId, input.planName, session);
  }

  async rebuildProjection(
    user: Types.ObjectId,
    planId: string,
    planName: string,
    session: ClientSession,
  ): Promise<EntitlementProjection> {
    const grants = await EntitlementGrant.find({ user })
      .sort({ sequence: 1 })
      .session(session)
      .lean<GrantLean[]>()
      .exec();
    const adjustments = await EntitlementAdjustment.find({ user })
      .sort({ sequence: 1 })
      .session(session)
      .lean<AdjustmentLean[]>()
      .exec();
    if (grants.length > 500) {
      throw new BillingDomainError(
        'entitlement_replay_limit',
        'Entitlement history requires operator review',
        409,
      );
    }

    const projection = replayEntitlement(
      grants.map((grant) => ({
        id: grant._id.toString(),
        sequence: grant.sequence,
        segmentId: grant.segmentId,
        segmentBaselineStartAt: grant.segmentBaselineStartAt,
        segmentAnchorDay: grant.segmentAnchorDay,
        durationUnit: grant.durationUnit,
        ...(grant.durationValue === undefined ? {} : { durationValue: grant.durationValue }),
      })),
      adjustments.map((adjustment) => ({
        sequence: adjustment.sequence,
        grantId: adjustment.grant.toString(),
        type: adjustment.type,
      })),
    );
    await EntitlementAccount.updateOne(
      { user },
      projection.startAt
        ? {
            $set: {
              planId,
              planName,
              currentStartAt: projection.startAt,
              currentEndAt: projection.endAt,
              perpetual: projection.perpetual,
              projectionChecksum: projectionChecksum(projection),
            },
          }
        : {
            $set: {
              planId,
              planName,
              perpetual: false,
              projectionChecksum: projectionChecksum(projection),
            },
            $unset: { currentStartAt: 1, currentEndAt: 1 },
          },
      { session },
    );
    return projection;
  }
}
