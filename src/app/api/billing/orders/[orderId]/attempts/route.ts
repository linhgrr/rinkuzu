import { withBillingUserOrderAction } from '@/lib/api/billing-user-action';
import { createBillingOrderRepository } from '@/lib/billing-factory';

/** A fresh payment attempt against an order whose previous one is spent. */
export const POST = withBillingUserOrderAction(
  'order_attempt_user',
  'create-attempt',
  async (userId, orderId) => {
    const attempt = await createBillingOrderRepository().createReplacementAttempt(userId, orderId);
    return { data: attempt.order, status: attempt.status };
  },
);
