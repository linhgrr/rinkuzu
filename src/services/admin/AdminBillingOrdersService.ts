import type {
  AdminBillingOrderDetailDto,
  AdminBillingOrderListDto,
  AdminBillingOrderListQueryDto,
} from '@/dtos/admin-billing-orders';
import type {
  AdminBillingOrderListOptions,
  IAdminBillingOrdersRepository,
} from '@/interfaces/repositories/IAdminBillingOrdersRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { AdminBillingOrdersDtoMapper } from '@/mappers/admin/AdminBillingOrdersDtoMapper';

export class AdminBillingOrdersService {
  constructor(private readonly repository: IAdminBillingOrdersRepository) {}

  async listOrders(
    query: AdminBillingOrderListQueryDto,
  ): Promise<ServiceResult<AdminBillingOrderListDto>> {
    try {
      const options: AdminBillingOrderListOptions = {
        page: query.page,
        limit: query.limit,
        bucket: query.bucket,
        ...(query.search === undefined ? {} : { search: query.search }),
      };
      // The health counters answer "is anything stuck?", which is the reason
      // this page exists, so they ship with every page of the list.
      const [result, health] = await Promise.all([
        this.repository.listOrders(options),
        this.repository.health(),
      ]);
      return {
        success: true,
        data: AdminBillingOrdersDtoMapper.toListDto(result.items, result.pagination, health),
      };
    } catch (error) {
      logger.error({ error }, 'Admin billing order list error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async getOrderDetail(publicId: string): Promise<ServiceResult<AdminBillingOrderDetailDto>> {
    try {
      const detail = await this.repository.findOrderDetail(publicId);
      if (!detail) return { success: false, error: 'Order not found', statusCode: 404 };
      return { success: true, data: AdminBillingOrdersDtoMapper.toDetailDto(detail) };
    } catch (error) {
      logger.error({ error }, 'Admin billing order detail error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }
}
