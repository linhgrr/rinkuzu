import 'server-only';

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { MongoAuthSignInRateLimiter } from '@/lib/integrations/auth-sign-in-rate-limiter';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';
import { env } from '@/lib/env';
import { AuthSignInService } from '@/services/auth/AuthSignInService';

let authSignInService: AuthSignInService | undefined;
let authSignInRepository: AuthAccountRepository | undefined;

export function getAuthSignInRepository(): AuthAccountRepository {
  authSignInRepository ??= new AuthAccountRepository();
  return authSignInRepository;
}

export function getAuthSignInService(): AuthSignInService {
  authSignInService ??= new AuthSignInService(
    getAuthSignInRepository(),
    new MongoAuthSignInRateLimiter(),
    new AuthAuditAdapter(),
    new NextDeferredTaskScheduler(),
    {
      maxAttempts: env.AUTH_LOCKOUT_MAX_ATTEMPTS,
      windowMs: env.AUTH_LOCKOUT_WINDOW_MINUTES * 60_000,
      lockoutMs: env.AUTH_LOCKOUT_DURATION_MINUTES * 60_000,
    },
  );
  return authSignInService;
}
