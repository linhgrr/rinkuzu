import connectDB from '@/lib/mongoose';
import { BillingOrder, PaymentWebhookInbox } from '@/models/Billing';
import type { IBillingIdleProbe } from '@/interfaces/repositories/IBillingIdleProbe';

/**
 * Two `exists` reads, each answered from an index the drains already use
 * (`status, nextAttemptAt, leaseUntil` on the inbox and `fulfillmentStatus,
 * fulfillmentNextAttemptAt` on orders), with the same due filters the drains
 * claim with. On an idle tick that is two index seeks returning nothing,
 * instead of a transaction around a `findOneAndUpdate` plus a sorted find.
 *
 * The filters only have to be no narrower than the drains': a "yes" that the
 * drain then finds nothing for costs one empty drain, a "no" that hides due
 * work would delay a paid order until the next tick.
 */
export class BillingIdleProbeRepository implements IBillingIdleProbe {
  async hasDueInboxWork(nowMs: number): Promise<boolean> {
    await connectDB();
    const now = new Date(nowMs);
    const [inbox, fulfillment] = await Promise.all([
      PaymentWebhookInbox.exists({
        status: { $in: ['verified', 'processing', 'retryable_failure', 'orphaned'] },
        nextAttemptAt: { $lte: now },
      }).exec(),
      BillingOrder.exists({
        fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
        fulfillmentNextAttemptAt: { $lte: now },
      }).exec(),
    ]);
    return inbox !== null || fulfillment !== null;
  }
}
