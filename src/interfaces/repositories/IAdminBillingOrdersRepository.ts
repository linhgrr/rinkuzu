import type {
  AdminBillingHealthSnapshot,
  AdminBillingOrderDetailRecord,
  AdminBillingOrderRecord,
  AdminBillingWebhookDiagnosticRecord,
} from '@/entities/AdminBillingOrders';
import type { WebhookVerificationClass } from '@/services/billing/domain/webhook-diagnostics';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import type { AdminOrderBucket } from '@/shared/constants/billing-order-buckets';

export interface AdminBillingOrderListOptions {
  page: number;
  limit: number;
  bucket: AdminOrderBucket;
  search?: string;
}

export interface AdminWebhookDiagnosticListOptions {
  page: number;
  limit: number;
  verificationClass?: WebhookVerificationClass;
}

export interface IAdminBillingOrdersRepository {
  listOrders(
    options: AdminBillingOrderListOptions,
  ): Promise<PaginatedRepositoryResult<AdminBillingOrderRecord>>;
  health(): Promise<AdminBillingHealthSnapshot>;
  findOrderDetail(publicId: string): Promise<AdminBillingOrderDetailRecord | null>;
  /**
   * Recent inbound deliveries, newest first. This is the only read path for a
   * retained webhook body: retention that nothing can read is a liability with
   * no upside, and the parser bug it exists to explain never gets fixed.
   */
  listWebhookDiagnostics(
    options: AdminWebhookDiagnosticListOptions,
  ): Promise<PaginatedRepositoryResult<AdminBillingWebhookDiagnosticRecord>>;
}
