import type {
  PaymentRequestDto,
  SubscriptionPlansResponseDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import {
  toSubscriptionPageViewModel,
  toSubscriptionStatusViewModel,
} from '@/features/subscription/mappers/subscription-page.mapper';
import type {
  SubscriptionPageViewModel,
  SubscriptionStatusViewModel,
} from '@/features/subscription/types/subscription-page-view-model';
import { fetchApiData } from '@/lib/api/client';

export async function fetchSubscriptionPageViewModel(): Promise<SubscriptionPageViewModel> {
  const [plans, status] = await Promise.all([
    fetchApiData<SubscriptionPlansResponseDto>('/api/subscription/plans'),
    fetchApiData<SubscriptionStatusResponseDto>('/api/subscription/status'),
  ]);

  return toSubscriptionPageViewModel(plans, status);
}

export async function createSubscriptionPaymentUrl(planId: string): Promise<string> {
  const payment = await fetchApiData<PaymentRequestDto>('/api/subscription/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId }),
  });

  return payment.paymentUrl;
}

export async function fetchSubscriptionStatusViewModel(): Promise<SubscriptionStatusViewModel> {
  const status = await fetchApiData<SubscriptionStatusResponseDto>('/api/subscription/status');
  return toSubscriptionStatusViewModel(status);
}
