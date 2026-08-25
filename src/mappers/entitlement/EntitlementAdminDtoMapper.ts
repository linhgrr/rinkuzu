import type { AdminMutableSubscriptionStatus } from '@/shared/constants/subscription-status';

export interface EntitlementAdminUpdateResult {
  id: string;
  status: AdminMutableSubscriptionStatus;
}

export class EntitlementAdminDtoMapper {
  static toUpdateResult(
    id: string,
    status: AdminMutableSubscriptionStatus,
  ): EntitlementAdminUpdateResult {
    return { id, status };
  }
}
