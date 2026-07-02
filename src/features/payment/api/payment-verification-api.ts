import { fetchApiData } from '@/lib/api/client';

export async function verifySubscriptionPayment(orderCode: string): Promise<void> {
  await fetchApiData('/api/subscription/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderCode }),
  });
}
