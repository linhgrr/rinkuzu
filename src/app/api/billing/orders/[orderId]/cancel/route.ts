import { withBillingUserOrderAction } from '@/lib/api/billing-user-action';
import { createBillingService } from '@/lib/billing-factory';

export const POST = withBillingUserOrderAction(
  'order_cancel_user',
  'cancel-order',
  async (userId, orderId) => ({ data: await createBillingService().cancelOrder(userId, orderId) }),
);
