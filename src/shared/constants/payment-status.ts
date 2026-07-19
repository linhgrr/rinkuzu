export const PAYOS_PAYMENT_STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED'] as const;

export type PayOSPaymentStatus = (typeof PAYOS_PAYMENT_STATUSES)[number];
