import 'server-only';
import { env } from '@/lib/env';

export const premiumFeatureFlags = Object.freeze({
  contribution: env.NEXT_PUBLIC_PREMIUM_CONTRIBUTION_ENABLED === 'true',
  review: env.PREMIUM_REVIEW_ENABLED === 'true',
  creditUnlock: env.PREMIUM_CREDIT_UNLOCK_ENABLED === 'true',
  strictDelivery: env.PREMIUM_STRICT_DELIVERY_ENABLED === 'true',
});
