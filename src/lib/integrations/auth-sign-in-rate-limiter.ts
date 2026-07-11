import type {
  AuthSignInRateLimitAction,
  IAuthRateLimiter,
} from '@/interfaces/services/IAuthRateLimiter';
import { checkAuthRateLimit, type AuthRateLimitResult } from '@/lib/auth-rate-limit';

export class MongoAuthSignInRateLimiter implements IAuthRateLimiter {
  consume(action: AuthSignInRateLimitAction, key: string): Promise<AuthRateLimitResult> {
    return checkAuthRateLimit(action, key);
  }
}
