import type { SubscriptionStatusResponseDto } from '@/dtos/subscription';
import type { IEntitlementRepository } from '@/interfaces/repositories/IEntitlementRepository';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class EntitlementService {
  constructor(private readonly repository: IEntitlementRepository) {}

  async isUserPremium(userId: string): Promise<boolean> {
    return (await this.repository.findCurrentByUserId(userId))?.isActive === true;
  }

  async getStatus(userId: string): Promise<SubscriptionStatusResponseDto> {
    const entitlement = await this.repository.findCurrentByUserId(userId);
    if (!entitlement) return { subscription: null, isPremium: false };

    const endDate = serializeOptionalDate(entitlement.endDate, 'entitlement.endDate');
    return {
      subscription: {
        plan: { id: entitlement.planId, name: entitlement.planName },
        startDate: serializeDate(entitlement.startDate, 'entitlement.startDate'),
        ...(endDate === undefined ? {} : { endDate }),
        isActive: entitlement.isActive,
        status: entitlement.isActive ? 'completed' : 'expired',
      },
      isPremium: entitlement.isActive,
    };
  }
}
