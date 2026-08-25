/**
 * Maps the canonical entitlement-account projection into the subscription-shaped
 * presentation contract used by account and admin UI surfaces.
 */
export interface EntitlementProjectionPersistenceFields {
  planId: string;
  planName: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export function mapEntitlementProjection(
  record: EntitlementProjectionPersistenceFields,
): EntitlementProjectionPersistenceFields {
  return {
    planId: record.planId,
    planName: record.planName,
    isActive: record.isActive,
    ...(record.startDate === undefined ? {} : { startDate: record.startDate }),
    ...(record.endDate === undefined ? {} : { endDate: record.endDate }),
    ...(record.payosOrderId === undefined ? {} : { payosOrderId: record.payosOrderId }),
    ...(record.payosTransactionId === undefined
      ? {}
      : { payosTransactionId: record.payosTransactionId }),
  };
}
