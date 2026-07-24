import { fetchApiData } from '@/lib/api/client';

export interface CheckoutPlan {
  id: string;
  name: string;
}

export interface CheckoutQuoteAmounts {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: 'VND';
  durationUnit: 'day' | 'month';
  durationValue: number;
  expiresAt: number;
}

export interface CheckoutQuote {
  token: string;
  quote: CheckoutQuoteAmounts;
  plan: CheckoutPlan;
}

export interface CheckoutOrder {
  id: string;
  plan: CheckoutPlan;
  currency: 'VND';
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  receivedAmount: number;
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  checkoutUrl?: string;
}

async function getCsrfToken(): Promise<string> {
  return (await fetchApiData<{ token: string }>('/api/v1/billing/csrf')).token;
}

async function billingMutation<T>(
  url: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const csrfToken = await getCsrfToken();
  return fetchApiData<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Billing-CSRF': csrfToken,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

export function requestCheckoutQuote(
  planId: string,
  promoCode: string | null,
): Promise<CheckoutQuote> {
  return billingMutation<CheckoutQuote>('/api/v1/billing/quotes', { planId, promoCode });
}

export function createCheckoutOrder(
  quoteToken: string,
  idempotencyKey: string,
): Promise<CheckoutOrder> {
  return billingMutation<CheckoutOrder>(
    '/api/v1/billing/orders',
    { quoteToken },
    { 'Idempotency-Key': idempotencyKey },
  );
}

export function getCheckoutOrder(orderId: string): Promise<CheckoutOrder> {
  return fetchApiData<CheckoutOrder>(`/api/v1/billing/orders/${encodeURIComponent(orderId)}`);
}

export function verifyCheckoutOrder(orderId: string): Promise<CheckoutOrder> {
  return billingMutation<CheckoutOrder>(
    `/api/v1/billing/orders/${encodeURIComponent(orderId)}/verify`,
    {},
  );
}

export function cancelCheckoutOrder(orderId: string): Promise<CheckoutOrder> {
  return billingMutation<CheckoutOrder>(
    `/api/v1/billing/orders/${encodeURIComponent(orderId)}/cancel`,
    {},
  );
}
