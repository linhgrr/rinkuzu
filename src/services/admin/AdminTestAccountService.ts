import type { AdminUserTestAccountDto } from '@/dtos/admin-user';
import type { AdminMutationActor } from '@/entities/AdminMutation';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type { IUserTestAccountRepository } from '@/interfaces/repositories/IUserTestAccountRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';

const TEST_ACCOUNT_AUDIT_ACTION = 'user.test_account.set';

interface AdminTestAccountServiceDeps {
  users: IUserTestAccountRepository;
  audit: IAdminAuditRepository;
}

/**
 * Marks or clears an account as a company/QA test account, which the
 * activation stats then never count. Every real change leaves exactly one
 * audit entry; a request that does not change the value writes nothing.
 */
export class AdminTestAccountService {
  constructor(private readonly deps: AdminTestAccountServiceDeps) {}

  async setTestAccount(
    userId: string,
    isTestAccount: boolean,
    actor: AdminMutationActor,
  ): Promise<ServiceResult<AdminUserTestAccountDto>> {
    let written: { previous: boolean } | null;
    try {
      written = await this.deps.users.setTestAccount(userId, isTestAccount);
    } catch (error) {
      logger.error({ error, userId }, 'Set test account flag failed');
      return { success: false, error: 'Failed to update test account flag', statusCode: 500 };
    }
    if (!written) return { success: false, error: 'User not found', statusCode: 404 };

    const changed = written.previous !== isTestAccount;
    if (changed) {
      try {
        await this.deps.audit.record({
          actorId: actor.id,
          actorEmail: actor.email,
          action: TEST_ACCOUNT_AUDIT_ACTION,
          entityType: 'user',
          entityId: userId,
          details: { isTestAccount: String(isTestAccount), previous: String(written.previous) },
        });
      } catch (error) {
        // An unaudited change must not stand: put the old value back.
        logger.error({ error, userId }, 'Test account audit failed; reverting the flag');
        await this.deps.users
          .revertTestAccount(userId, isTestAccount, written.previous)
          .catch((revertError: unknown) =>
            logger.error({ error: revertError, userId }, 'Test account flag revert failed'),
          );
        return { success: false, error: 'Failed to update test account flag', statusCode: 500 };
      }
    }

    return { success: true, data: { id: userId, isTestAccount, changed } };
  }
}
