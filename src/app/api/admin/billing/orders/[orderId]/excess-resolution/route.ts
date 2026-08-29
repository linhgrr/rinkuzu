import { resolveOrderExcessSchema } from '@/dtos/billing';
import { withBillingOrderMutation } from '@/lib/api/billing-order-mutation';
import { createAdjustmentDeps } from '@/lib/billing-factory';
import { resolveOrderExcess } from '@/services/billing/adjustments/record-adjustment';

/**
 * Closes an overpayment.
 *
 * Automation can see that a customer paid too much but must never decide what
 * happens to the surplus, so `unallocated` is a queue with no automatic exit.
 * This is that exit — and it is a money event, not a flag: the verdict is
 * recorded as an excess-allocated adjustment and the field on the order is
 * derived from it, so the queue and the ledger cannot disagree.
 */
export const POST = withBillingOrderMutation(
  resolveOrderExcessSchema,
  'admin-resolve-order-excess',
  (input, recordedBy) => resolveOrderExcess(createAdjustmentDeps(), { ...input, recordedBy }),
);
