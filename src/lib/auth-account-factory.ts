import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { AuthAccountService } from '@/services/auth/AuthAccountService';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { AuthMailNotifier } from '@/lib/integrations/auth-notifier';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';

let authAccountService: AuthAccountService | undefined;

export function getAuthAccountService(): AuthAccountService {
  authAccountService ??= new AuthAccountService(
    new AuthAccountRepository(),
    new AuthMailNotifier(),
    new AuthAuditAdapter(),
    new NextDeferredTaskScheduler(),
  );
  return authAccountService;
}
