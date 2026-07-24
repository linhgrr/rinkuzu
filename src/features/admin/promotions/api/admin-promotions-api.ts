import { fetchApiData } from '@/lib/api/client';

async function getBillingCsrfToken(): Promise<string> {
  return (await fetchApiData<{ token: string }>('/api/v1/billing/csrf', { method: 'POST' })).token;
}

async function adminPromotionMutation<T>(method: 'POST' | 'PATCH', body: object): Promise<T> {
  const csrfToken = await getBillingCsrfToken();
  return fetchApiData<T>('/api/admin/promotions', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Billing-CSRF': csrfToken,
    },
    body: JSON.stringify(body),
  });
}

export interface AdminPromotion {
  id: string;
  code: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  fixedAmount?: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  reservedCount: number;
  redeemedCount: number;
  overrunCount: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface AdminPromotionCreateInput {
  code: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  fixedAmount?: number;
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
}

export function fetchAdminPromotions(): Promise<AdminPromotion[]> {
  return fetchApiData<AdminPromotion[]>('/api/admin/promotions');
}

export function createAdminPromotion(input: AdminPromotionCreateInput): Promise<AdminPromotion> {
  return adminPromotionMutation<AdminPromotion>('POST', input);
}

export function archiveAdminPromotion(id: string): Promise<AdminPromotion> {
  return adminPromotionMutation<AdminPromotion>('PATCH', { id });
}
