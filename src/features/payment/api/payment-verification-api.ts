import type {
  PaymentCancellationReconciliationDto,
  SubscriptionActivationDto,
} from '@/dtos/subscription';
import { fetchApiData } from '@/lib/api/client';

export async function verifySubscriptionPayment(
  orderCode: string,
): Promise<SubscriptionActivationDto> {
  return fetchApiData<SubscriptionActivationDto>('/api/subscription/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderCode }),
  });
}

export async function reconcileSubscriptionPaymentCancellation(
  orderCode: string,
  signal?: AbortSignal,
): Promise<PaymentCancellationReconciliationDto> {
  return fetchApiData<PaymentCancellationReconciliationDto>('/api/subscription/cancel-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderCode }),
    ...(signal !== undefined && { signal }),
  });
}
