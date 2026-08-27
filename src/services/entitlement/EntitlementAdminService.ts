import { randomUUID } from 'node:crypto';
import type { ServiceResult } from '@/interfaces/services/types';
import { invalidateEntitlements } from '@/lib/entitlements/cache';
import type { IEntitlementAdminRepository } from '@/interfaces/repositories/IEntitlementAdminRepository';
import {
  EntitlementAdminDtoMapper,
  type EntitlementAdminUpdateResult,
} from '@/mappers/entitlement/EntitlementAdminDtoMapper';

export class EntitlementAdminService {
  constructor(private readonly ledger: IEntitlementAdminRepository) {}

  /**
   * Revokes every grant on the account. This is the break-glass control for
   * fraud and abuse, not a lifecycle transition: it is irreversible from the
   * admin surface and removes Premium the customer may have paid for in other
   * orders. Refund and chargeback clawbacks revoke a single grant instead.
   */
  async revoke(
    accountId: string,
    reason: string,
  ): Promise<ServiceResult<EntitlementAdminUpdateResult>> {
    try {
      const userId = await this.ledger.revokeAccount(accountId, `admin_${randomUUID()}`, reason);
      if (!userId) {
        return { success: false, error: 'Entitlement account not found', statusCode: 404 };
      }
      invalidateEntitlements(userId);
      return { success: true, data: EntitlementAdminDtoMapper.toRevokeResult(accountId) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke entitlement',
        statusCode: 500,
      };
    }
  }
}
