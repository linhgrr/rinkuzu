import { externalMoneyAdjustmentSchema } from '@/dtos/billing';
import { withBillingOrderMutation } from '@/lib/api/billing-order-mutation';
import { createAdjustmentDeps } from '@/lib/billing-factory';
import { recordExternalMoneyAdjustment } from '@/services/billing/adjustments/record-adjustment';

/**
 * Records money that moved outside the provider — a bank refund, a chargeback,
 * a manual credit. The operator's identity is the only audit trail these have.
 */
export const POST = withBillingOrderMutation(
  externalMoneyAdjustmentSchema,
  'admin-record-external-adjustment',
  (input, recordedBy) =>
    recordExternalMoneyAdjustment(createAdjustmentDeps(), { ...input, recordedBy }),
);
