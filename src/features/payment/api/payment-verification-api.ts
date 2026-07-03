import type { SubscriptionActivationDto } from '@/dtos/subscription';
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
