import type { AuthRateLimitAction, AuthRateLimitResult } from '@/lib/auth-rate-limit';

export type AuthSignInRateLimitAction = Extract<
  AuthRateLimitAction,
  'credentials_ip' | 'credentials_identity'
>;

export interface IAuthRateLimiter {
  consume(action: AuthSignInRateLimitAction, key: string): Promise<AuthRateLimitResult>;
}
