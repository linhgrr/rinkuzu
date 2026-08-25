export interface IEntitlementAdminRepository {
  revokeAccount(accountId: string, sourceId: string, reason: string): Promise<string | null>;
}
