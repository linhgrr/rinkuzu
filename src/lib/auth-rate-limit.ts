import 'server-only';

import type { NextResponse } from 'next/server';

import { apiErr } from '@/lib/api/response';
import {
  createRateLimiterRegistry,
  type RateLimitOutcome,
  type RateLimitWindow,
} from '@/lib/rate-limit-core';

export type AuthRateLimitAction =
  | 'credentials_ip'
  | 'credentials_identity'
  | 'register_ip'
  | 'forgot_password_email'
  | 'resend_verification_email'
  | 'reset_password_token_ip'
  | 'verify_email_ip'
  | 'pdf_upload_intent_user'
  | 'attempt_claim_user'
  | 'attempt_claim_ip';

const DEFAULTS: Record<AuthRateLimitAction, RateLimitWindow> = {
  credentials_ip: { points: 20, durationSec: 60 * 15 },
  credentials_identity: { points: 10, durationSec: 60 * 15 },
  register_ip: { points: 5, durationSec: 60 * 60 }, // 5 / hour / IP
  forgot_password_email: { points: 3, durationSec: 60 * 60 }, // 3 / hour / email
  resend_verification_email: { points: 3, durationSec: 60 * 60 }, // 3 / hour / email
  reset_password_token_ip: { points: 10, durationSec: 60 * 15 }, // 10 / 15min / IP
  verify_email_ip: { points: 20, durationSec: 60 * 15 }, // 20 / 15min / IP
  pdf_upload_intent_user: { points: 20, durationSec: 60 * 15 }, // 20 upload URLs / 15min / user
  attempt_claim_user: { points: 10, durationSec: 60 }, // 10 guest-attempt claims / min / user
  attempt_claim_ip: { points: 30, durationSec: 60 }, // 30 guest-attempt claims / min / IP
};

const registry = createRateLimiterRegistry<AuthRateLimitAction>(
  { collection: 'auth_rate_limits', keyPrefix: 'auth:', envPrefix: 'AUTH_RATE' },
  DEFAULTS,
);

export type AuthRateLimitResult = RateLimitOutcome;

export async function checkAuthRateLimit(
  action: AuthRateLimitAction,
  key: string,
): Promise<AuthRateLimitResult> {
  return registry.consume(action, key);
}

export function rateLimitResponse(
  result: Extract<AuthRateLimitResult, { allowed: false }>,
): NextResponse {
  return apiErr('rate_limit_exceeded', 'Too many requests. Try again later.', 429, {
    meta: { retryAfterSeconds: result.retryAfterSeconds, limit: result.limit },
  });
}
