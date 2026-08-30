import { createBillingOrderRequestSchema } from '@/dtos/billing';
import { withBillingUserBodyAction } from '@/lib/api/billing-user-action';
import { createBillingOrderRepository } from '@/lib/billing-factory';

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
    return { data: created.order, status: created.status };
  },
);
