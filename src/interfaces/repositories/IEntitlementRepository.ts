import type { CurrentEntitlement } from '@/entities/Entitlement';

export interface IEntitlementRepository {
  findCurrentByUserId(userId: string, now?: Date): Promise<CurrentEntitlement | null>;
}
