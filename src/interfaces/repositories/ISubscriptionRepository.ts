import { ISubscription } from '@/models/Subscription';
import { PaginationMeta } from '@/types';

export interface ISubscriptionRepository {
  create(subscriptionData: Partial<ISubscription>): Promise<ISubscription>;
  findById(id: string): Promise<ISubscription | null>;
  findByOrderId(orderId: string): Promise<ISubscription | null>;
  findByUser(userId: string): Promise<ISubscription[]>;
  findExpiredSubscriptions(): Promise<ISubscription[]>;
  updateById(id: string, updateData: Partial<ISubscription>): Promise<ISubscription | null>;
  updateByOrderId(
    orderId: string,
    updateData: Partial<ISubscription>,
  ): Promise<ISubscription | null>;
  deleteById(id: string): Promise<boolean>;
  deleteByOrderId(orderId: string): Promise<boolean>;
  findWithPagination(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{
    subscriptions: ISubscription[];
    pagination: PaginationMeta;
  }>;
}
