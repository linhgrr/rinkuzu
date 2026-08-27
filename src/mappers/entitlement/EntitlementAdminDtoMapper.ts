export interface EntitlementAdminUpdateResult {
  id: string;
  /**
   * The projection has no grants left, so the derived status is always
   * `expired`. Reporting the operator's requested label here would claim a
   * state the ledger does not hold.
   */
  status: 'expired';
  isActive: false;
}

export class EntitlementAdminDtoMapper {
  static toRevokeResult(id: string): EntitlementAdminUpdateResult {
    return { id, status: 'expired', isActive: false };
  }
}
