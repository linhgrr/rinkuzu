import { withBillingUserOrderAction } from '@/lib/api/billing-user-action';
import { createBillingService } from '@/lib/billing-factory';

export const POST = withBillingUserOrderAction(
  'order_verify_user',
  'verify-order',
  async (userId, orderId) => ({ data: await createBillingService().verifyOrder(userId, orderId) }),
);
