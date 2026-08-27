import type {
  AdminBillingHealthSnapshot,
  AdminBillingOrderDetailRecord,
  AdminBillingOrderRecord,
} from '@/entities/AdminBillingOrders';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import type { AdminOrderBucket } from '@/shared/constants/billing-order-buckets';

export interface AdminBillingOrderListOptions {
  page: number;
  limit: number;
  bucket: AdminOrderBucket;
  search?: string;
}

export interface IAdminBillingOrdersRepository {
  listOrders(
    options: AdminBillingOrderListOptions,
  ): Promise<PaginatedRepositoryResult<AdminBillingOrderRecord>>;
  health(): Promise<AdminBillingHealthSnapshot>;
  findOrderDetail(publicId: string): Promise<AdminBillingOrderDetailRecord | null>;
}
