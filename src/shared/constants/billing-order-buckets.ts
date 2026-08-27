/**
 * Operator-facing groupings over the order pipeline. Lives in shared
 * constants so the presentation layer can name a bucket without reaching into
 * the DTO layer.
 */
export const ADMIN_ORDER_BUCKETS = ['attention', 'all', 'unpaid', 'paid', 'settled_out'] as const;
export type AdminOrderBucket = (typeof ADMIN_ORDER_BUCKETS)[number];
