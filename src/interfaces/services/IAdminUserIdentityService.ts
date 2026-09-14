import type { AdminUserIdentityDto } from '@/dtos/admin-personal-learning';

/**
 * Account labelling for admin analytics rows that arrive from the adaptive
 * service carrying nothing but a user id. Both methods degrade instead of
 * throwing: identity is decoration, and losing it must not lose the row.
 */
export interface IAdminUserIdentityService {
  /** Identities for the given ids, keyed by id. Unknown ids are simply absent. */
  getUserIdentities(userIds: readonly string[]): Promise<Map<string, AdminUserIdentityDto>>;
  /** Ids of accounts whose name, display name or email matches `search`. */
  findUserIdsByNameOrEmail(search: string, limit: number): Promise<string[]>;
}
