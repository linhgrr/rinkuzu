import type {
  AdminSubscriptionListDto,
  AdminSubscriptionListQueryDto,
  AdminUserSubscriptionGrantDto,
  BillingPlanDto,
  CreatePlanRequestDto,
  GrantUserSubscriptionRequestDto,
  UpdatePlanRequestDto,
} from '@/dtos/admin-billing';
import type { ServiceResult } from '@/interfaces/services/types';

export interface IAdminBillingService {
  listPlans(): Promise<ServiceResult<BillingPlanDto[]>>;

  createPlan(input: CreatePlanRequestDto): Promise<ServiceResult<BillingPlanDto>>;

  updatePlan(input: UpdatePlanRequestDto): Promise<ServiceResult<BillingPlanDto>>;

  deletePlan(planId: string): Promise<ServiceResult<null>>;

  listSubscriptions(
    options: AdminSubscriptionListQueryDto,
  ): Promise<ServiceResult<AdminSubscriptionListDto>>;

  grantUserSubscription(
    input: GrantUserSubscriptionRequestDto,
  ): Promise<ServiceResult<AdminUserSubscriptionGrantDto>>;
}
