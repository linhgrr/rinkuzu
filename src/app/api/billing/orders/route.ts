import { createBillingOrderRequestSchema } from '@/dtos/billing';
import { scheduleCheckoutStartedServerEvent } from '@/lib/analytics/checkout-started-server';
import { withBillingUserBodyAction } from '@/lib/api/billing-user-action';
import { createBillingOrderRepository } from '@/lib/billing-factory';

const ORDER_CREATED = 201;

export const POST = withBillingUserBodyAction(
  createBillingOrderRequestSchema,
  'order_create_user',
  'create-order',
  async (userId, body, request) => {
    const created = await createBillingOrderRepository().createOrder({
      userId,
      quoteToken: body.quoteToken,
      idempotencyKey: request.headers.get('idempotency-key') ?? '',
    });
    // Only a new order counts; an idempotent replay (200) is the same checkout.
    if (created.status === ORDER_CREATED) {
      scheduleCheckoutStartedServerEvent(request, created.order.plan.id);
    }
    return { data: created.order, status: created.status };
  },
);
