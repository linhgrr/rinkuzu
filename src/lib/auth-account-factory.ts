import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';
import { AuthAccountService } from '@/services/auth/AuthAccountService';
import { AuthAuditAdapter } from '@/lib/integrations/auth-audit';
import { AuthMailNotifier } from '@/lib/integrations/auth-notifier';
import { NextDeferredTaskScheduler } from '@/lib/integrations/next-deferred-task-scheduler';
import { getGuestAttemptClaimService } from '@/lib/guest-attempt-claim-factory';

let authAccountService: AuthAccountService | undefined;

export function getAuthAccountService(): AuthAccountService {
  authAccountService ??= new AuthAccountService(
    new AuthAccountRepository(),
    new AuthMailNotifier(),
    new AuthAuditAdapter(),
    new NextDeferredTaskScheduler(),
    getGuestAttemptClaimService(),
    // Loaded on first use: the quiz service graph stays out of every auth route.
    {
      claimHashed: async (userId, hashes) =>
        (await import('@/lib/guest-draft-claim-factory'))
          .getGuestDraftClaimService()
          .claimHashed(userId, hashes),
    },
  );
  return authAccountService;
}
