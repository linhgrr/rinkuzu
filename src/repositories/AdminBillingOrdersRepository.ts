import { Types, type PipelineStage } from 'mongoose';
import connectDB from '@/lib/mongoose';
import {
  BillingOrder,
  EntitlementAdjustment,
  EntitlementAccount,
  EntitlementGrant,
  ExternalMoneyAdjustment,
  PaymentAttempt,
  PaymentTransaction,
  PaymentWebhookInbox,
} from '@/models/Billing';
import type {
  AdminBillingAdjustmentRecord,
  AdminBillingAttemptRecord,
  AdminBillingHealthSnapshot,
  AdminBillingOrderDetailRecord,
  AdminBillingOrderRecord,
  AdminBillingTransactionRecord,
} from '@/entities/AdminBillingOrders';
import type {
  AdminBillingOrderListOptions,
  IAdminBillingOrdersRepository,
} from '@/interfaces/repositories/IAdminBillingOrdersRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import { buildPaginationMeta } from '@/lib/pagination';
import type { AdminOrderBucket } from '@/shared/constants/billing-order-buckets';
import {
  AdminBillingOrdersPersistenceMapper,
  type AdminBillingOrderPersistenceRow,
} from '@/repositories/mappers/AdminBillingOrdersPersistenceMapper';
import type {
  AdminBillingAdjustmentPersistence,
  AdminBillingAttemptPersistence,
  AdminBillingTransactionPersistence,
} from '@/repositories/types/AdminBillingOrdersPersistence';

/**
 * Everything the pipeline could not settle by itself. Built by a function so
 * the list filter and the health counter cannot drift apart.
 */
function attentionFilter(): Record<string, unknown> {
  return {
    $or: [
      { collectionStatus: { $in: ['review', 'partial', 'overpaid'] } },
      { fulfillmentStatus: 'review' },
      { excessResolution: 'unallocated' },
      { settlementStatus: { $in: ['charged_back', 'disputed', 'reversed'] } },
    ],
  };
}

function bucketFilter(bucket: AdminOrderBucket): Record<string, unknown> {
  switch (bucket) {
    case 'attention':
      return attentionFilter();
    case 'unpaid':
      return { collectionStatus: 'unpaid' };
    case 'paid':
      return { collectionStatus: { $in: ['paid', 'overpaid'] } };
    case 'settled_out':
      return {
        settlementStatus: { $in: ['refunded', 'partially_refunded', 'charged_back', 'reversed'] },
      };
    case 'all':
      return {};
  }
}

interface OrderFacetCount {
  totalItems: number;
}

interface OrderFacet {
  items: AdminBillingOrderPersistenceRow[];
  meta: OrderFacetCount[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminBillingOrdersRepository implements IAdminBillingOrdersRepository {
  async listOrders(
    options: AdminBillingOrderListOptions,
  ): Promise<PaginatedRepositoryResult<AdminBillingOrderRecord>> {
    await connectDB();
    const skip = (options.page - 1) * options.limit;
    const search = options.search?.trim();

    // Indexed order fields are matched before the user lookup so a search by
    // public id or provider order code never scans the join.
    const preMatch: Record<string, unknown>[] = [];
    const bucket = bucketFilter(options.bucket);
    if (Object.keys(bucket).length > 0) preMatch.push(bucket);

    let emailPattern: RegExp | null = null;
    if (search) {
      if (search.includes('@')) {
        // Resolvable only after the lookup; applied as a post-match below.
        emailPattern = new RegExp(escapeRegex(search), 'i');
      } else {
        const orderCode = Number(search);
        const searchOr: Record<string, unknown>[] = [{ publicId: search }];
        if (Number.isSafeInteger(orderCode) && orderCode > 0) searchOr.push({ orderCode });
        preMatch.push({ $or: searchOr });
      }
    }

    const emailMatch: PipelineStage[] = emailPattern
      ? [{ $match: { userEmail: { $regex: emailPattern } } }]
      : [];

    const pipeline: PipelineStage[] = [
      ...(preMatch.length > 0 ? [{ $match: { $and: preMatch } } as PipelineStage.Match] : []),
      { $sort: { updatedAt: -1 } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $set: { userEmail: { $first: '$userDoc.email' } } },
      ...emailMatch,
      {
        $lookup: {
          from: 'paymentattempts',
          let: { orderId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$order', '$$orderId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { collectionStatus: 1 } },
          ],
          as: 'latestAttempt',
        },
      },
      { $set: { attemptCollectionStatus: { $first: '$latestAttempt.collectionStatus' } } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: options.limit },
            {
              $project: {
                _id: 0,
                publicId: 1,
                orderCode: 1,
                user: 1,
                userEmail: 1,
                planId: 1,
                planName: 1,
                currency: 1,
                finalAmount: 1,
                receivedAmount: 1,
                excessAmount: 1,
                excessResolution: 1,
                collectionStatus: 1,
                fulfillmentStatus: 1,
                settlementStatus: 1,
                attemptCollectionStatus: 1,
                promotionCode: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ];

    const [result] = await BillingOrder.aggregate<OrderFacet>(pipeline);
    const totalItems = result?.meta[0]?.totalItems ?? 0;
    return {
      items: (result?.items ?? []).map(AdminBillingOrdersPersistenceMapper.toOrder),
      pagination: buildPaginationMeta(options.page, options.limit, totalItems),
    };
  }

  async health(): Promise<AdminBillingHealthSnapshot> {
    await connectDB();
    const [
      ordersNeedingAttention,
      paidButUnfulfilled,
      attemptsInReview,
      attemptsIndeterminate,
      inboxOrphaned,
      inboxRetryable,
      inboxDeadLettered,
    ] = await Promise.all([
      BillingOrder.countDocuments(attentionFilter()),
      BillingOrder.countDocuments({
        collectionStatus: { $in: ['paid', 'overpaid'] },
        fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
      }),
      PaymentAttempt.countDocuments({ collectionStatus: 'review' }),
      // The provider neither confirmed nor denied the checkout link, so we do
      // not know whether a payable link is live out there.
      PaymentAttempt.countDocuments({ createOutcome: 'indeterminate' }),
      PaymentWebhookInbox.countDocuments({ status: 'orphaned' }),
      PaymentWebhookInbox.countDocuments({ status: 'retryable_failure' }),
      PaymentWebhookInbox.countDocuments({ status: { $in: ['dead_letter', 'permanent_failure'] } }),
    ]);
    return {
      ordersNeedingAttention,
      paidButUnfulfilled,
      attemptsInReview,
      attemptsIndeterminate,
      inboxOrphaned,
      inboxRetryable,
      inboxDeadLettered,
    };
  }

  async findOrderDetail(publicId: string): Promise<AdminBillingOrderDetailRecord | null> {
    await connectDB();
    const [row] = await BillingOrder.aggregate<
      AdminBillingOrderPersistenceRow & { _id: Types.ObjectId }
    >([
      { $match: { publicId } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $set: { userEmail: { $first: '$userDoc.email' } } },
      { $unset: 'userDoc' },
    ]);
    if (!row) return null;

    const [attempts, transactions, adjustments, grant, account] = await Promise.all([
      PaymentAttempt.find({ order: row._id })
        .sort({ createdAt: -1 })
        .lean<AdminBillingAttemptPersistence[]>()
        .exec(),
      PaymentTransaction.find({ order: row._id })
        .sort({ providerEventAt: -1 })
        .lean<AdminBillingTransactionPersistence[]>()
        .exec(),
      ExternalMoneyAdjustment.find({ order: row._id })
        .sort({ occurredAt: -1 })
        .lean<AdminBillingAdjustmentPersistence[]>()
        .exec(),
      EntitlementGrant.findOne({ sourceType: 'billing_order', sourceId: row._id.toString() })
        .select({ _id: 1 })
        .lean<{ _id: Types.ObjectId }>()
        .exec(),
      EntitlementAccount.findOne({ user: row.user })
        .select({ currentEndAt: 1, perpetual: 1 })
        .lean<{ currentEndAt?: Date; perpetual?: boolean }>()
        .exec(),
    ]);

    // A revoke is the *latest* adjustment on the grant, not merely any of them.
    const latestAdjustment = grant
      ? await EntitlementAdjustment.findOne({ grant: grant._id })
          .sort({ sequence: -1 })
          .select({ type: 1 })
          .lean<{ type: 'revoke' | 'restore' }>()
          .exec()
      : null;

    const attemptRecords: AdminBillingAttemptRecord[] = attempts.map(
      AdminBillingOrdersPersistenceMapper.toAttempt,
    );
    const transactionRecords: AdminBillingTransactionRecord[] = transactions.map(
      AdminBillingOrdersPersistenceMapper.toTransaction,
    );
    const adjustmentRecords: AdminBillingAdjustmentRecord[] = adjustments.map(
      AdminBillingOrdersPersistenceMapper.toAdjustment,
    );

    return {
      order: AdminBillingOrdersPersistenceMapper.toOrder(row),
      attempts: attemptRecords,
      transactions: transactionRecords,
      adjustments: adjustmentRecords,
      entitlement: {
        granted: grant !== null,
        revoked: latestAdjustment?.type === 'revoke',
        ...(account?.currentEndAt === undefined ? {} : { currentEndAt: account.currentEndAt }),
        perpetual: account?.perpetual === true,
      },
    };
  }
}
