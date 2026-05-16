import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z, ZodError } from 'zod';
import { authOptions } from '@/lib/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr } from '@/lib/api/response';
import { extractUnknownErrorMessage } from '@/lib/api/error';

const verifySubscriptionSchema = z.object({
  orderCode: z.union([
    z.number().int().positive().safe(),
    z.string().trim().regex(/^\d+$/, 'Order code must be a positive integer'),
  ]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return apiErr('validation_error', 'Request body must be valid JSON', 400);
    }

    let input;
    try {
      input = verifySubscriptionSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        return apiErr('validation_error', error.issues[0]?.message ?? 'Invalid order code', 400);
      }
      throw error;
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const numericOrderCode =
      typeof input.orderCode === 'string' ? Number.parseInt(input.orderCode, 10) : input.orderCode;

    const result = await subscriptionService.verifyAndActivateSubscription(
      numericOrderCode,
      session.user.id,
    );

    return apiOk(result);
  } catch (error: unknown) {
    console.error('Error verifying payment:', error);
    return apiErr(
      'internal_error',
      extractUnknownErrorMessage(error, 'Failed to verify payment'),
      500,
    );
  }
}
