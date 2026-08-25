import { randomUUID } from 'node:crypto';
import type { AdminMutableSubscriptionStatus } from '@/shared/constants/subscription-status';
import type { ServiceResult } from '@/interfaces/services/types';
import { invalidateEntitlements } from '@/lib/entitlements/cache';
import type { IEntitlementAdminRepository } from '@/interfaces/repositories/IEntitlementAdminRepository';
import {
  EntitlementAdminDtoMapper,
  type EntitlementAdminUpdateResult,
} from '@/mappers/entitlement/EntitlementAdminDtoMapper';

export class EntitlementAdminService {
  constructor(private readonly ledger: IEntitlementAdminRepository) {}

  async revoke(
    accountId: string,
    status: AdminMutableSubscriptionStatus,
  ): Promise<ServiceResult<EntitlementAdminUpdateResult>> {
    try {
      const userId = await this.ledger.revokeAccount(
        accountId,
        `admin_${randomUUID()}`,
        `Admin changed entitlement status to ${status}`,
      );
      if (!userId) {
        return { success: false, error: 'Entitlement account not found', statusCode: 404 };
      }
      invalidateEntitlements(userId);
      return { success: true, data: EntitlementAdminDtoMapper.toUpdateResult(accountId, status) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke entitlement',
        statusCode: 500,
      };
    }
  }
}
