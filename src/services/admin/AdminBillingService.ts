import { randomUUID } from 'node:crypto';
import type {
  AdminSubscriptionListDto,
  AdminSubscriptionListQueryDto,
  AdminUserSubscriptionGrantDto,
  BillingPlanDto,
  CreatePlanRequestDto,
  GrantUserSubscriptionRequestDto,
  UpdatePlanRequestDto,
} from '@/dtos/admin-billing';
import type { DeleteResultDto } from '@/dtos/common';
import {
  AdminBillingUserNotFoundError,
  BillingPlanConflictError,
  BillingPlanInUseError,
  BillingPlanUnavailableError,
  type AdminUserSubscriptionGrant,
} from '@/entities/AdminBilling';
import type {
  AdminSubscriptionListOptions,
  IAdminBillingRepository,
  UpdateBillingPlanData,
} from '@/interfaces/repositories/IAdminBillingRepository';
import type { IAdminBillingService } from '@/interfaces/services/IAdminBillingService';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { AdminBillingDtoMapper } from '@/mappers/admin/AdminBillingDtoMapper';
import { DurationUtils } from '@/types/subscription';

function createPlanId(): string {
  return `plan_${randomUUID()}`;
}

export class AdminBillingService implements IAdminBillingService {
  constructor(private readonly repository: IAdminBillingRepository) {}

  async listPlans(): Promise<ServiceResult<BillingPlanDto[]>> {
    try {
      const plans = await this.repository.listPlans();
      return {
        success: true,
        data: plans.map((plan) => AdminBillingDtoMapper.toPlanDto(plan)),
      };
    } catch (error) {
      logger.error({ error }, 'Admin get plans error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async createPlan(input: CreatePlanRequestDto): Promise<ServiceResult<BillingPlanDto>> {
    try {
      const plan = await this.repository.createPlan({
        id: createPlanId(),
        name: input.name,
        price: input.price,
        duration: input.duration,
        isActive: input.isActive,
      });
      return { success: true, data: AdminBillingDtoMapper.toPlanDto(plan) };
    } catch (error) {
      if (error instanceof BillingPlanConflictError) {
        return { success: false, error: error.message, statusCode: 409 };
      }
      logger.error({ error }, 'Admin create plan error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async updatePlan(input: UpdatePlanRequestDto): Promise<ServiceResult<BillingPlanDto>> {
    try {
      const { id, ...update } = input;
      const updateData: UpdateBillingPlanData = {
        ...(update.name !== undefined && { name: update.name }),
        ...(update.price !== undefined && { price: update.price }),
        ...(update.duration !== undefined && { duration: update.duration }),
        ...(update.isActive !== undefined && { isActive: update.isActive }),
      };
      const updated = await this.repository.updatePlan(id, updateData);
      if (!updated) return { success: false, error: 'Plan not found', statusCode: 404 };
      return { success: true, data: AdminBillingDtoMapper.toPlanDto(updated) };
    } catch (error) {
      logger.error({ error }, 'Admin update plan error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async deletePlan(planId: string): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const deleted = await this.repository.deletePlan(planId);
      if (!deleted) return { success: false, error: 'Plan not found', statusCode: 404 };
      return { success: true, data: DeleteResultDtoMapper.toDto(planId) };
    } catch (error) {
      if (error instanceof BillingPlanInUseError) {
        return { success: false, error: error.message, statusCode: 409 };
      }
      logger.error({ error }, 'Admin delete plan error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async listSubscriptions(
    options: AdminSubscriptionListQueryDto,
  ): Promise<ServiceResult<AdminSubscriptionListDto>> {
    try {
      const repositoryOptions: AdminSubscriptionListOptions = {
        page: options.page,
        limit: options.limit,
        ...(options.status !== undefined && { status: options.status }),
        ...(options.search !== undefined && { search: options.search }),
      };
      const result = await this.repository.listSubscriptions(repositoryOptions);
      return {
        success: true,
        data: AdminBillingDtoMapper.toSubscriptionListDto(result.items, result.pagination),
      };
    } catch (error) {
      logger.error({ error }, 'Admin subscriptions list error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async grantUserSubscription(
    input: GrantUserSubscriptionRequestDto,
  ): Promise<ServiceResult<AdminUserSubscriptionGrantDto>> {
    try {
      const [user, plan] = await Promise.all([
        this.repository.findUserById(input.userId),
        this.repository.findPlanById(input.planId),
      ]);
      if (!user) return { success: false, error: 'User not found', statusCode: 404 };
      if (!plan) return { success: false, error: 'Plan not found', statusCode: 404 };
      if (!plan.isActive) {
        return { success: false, error: 'Plan is inactive', statusCode: 409 };
      }

      const startDate = new Date();
      const endDate = DurationUtils.calculateEndDate(startDate, plan.duration);
      const grant: AdminUserSubscriptionGrant = {
        userId: user.id,
        userEmail: user.email,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        startDate,
        ...(endDate !== undefined && { endDate }),
      };

      await this.repository.addUserSubscriptionGrant({
        userId: grant.userId,
        userEmail: grant.userEmail,
        planId: grant.planId,
        amount: grant.amount,
        startDate: grant.startDate,
        ...(endDate !== undefined && { endDate }),
      });
      return { success: true, data: AdminBillingDtoMapper.toGrantDto(grant) };
    } catch (error) {
      if (error instanceof AdminBillingUserNotFoundError) {
        return { success: false, error: error.message, statusCode: 404 };
      }
      if (error instanceof BillingPlanUnavailableError) {
        return { success: false, error: error.message, statusCode: 409 };
      }
      logger.error({ error }, 'Add subscription error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }
}
