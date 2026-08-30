import { billingQuoteRequestSchema } from '@/dtos/billing';
import { withBillingUserBodyAction } from '@/lib/api/billing-user-action';
import { createBillingOrderRepository } from '@/lib/billing-factory';

export const POST = withBillingUserBodyAction(
  billingQuoteRequestSchema,
  'quote_user',
  'quote',
  async (userId, body) => ({
    data: await createBillingOrderRepository().quote(userId, body.planId, body.promoCode),
  }),
);
